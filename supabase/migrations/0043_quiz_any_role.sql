-- ============================================================================
-- BCJ Learn — Migration 0043: any signed-in user can take a quiz
-- ----------------------------------------------------------------------------
-- Per Nancy's Jun-16 walkthrough: Department Leads (teacher) and Admins must be
-- able to be assigned to a module and TAKE its quiz (e.g. a lead who runs the
-- managers should be able to sit the exam; staff test runs before launch).
--
-- The only hard block was the manager-role guard inside start_quiz_attempt.
-- Everything else is already role-agnostic (RLS keys off auth.uid(); the quiz
-- RPCs are SECURITY DEFINER and read questions regardless of caller role).
--
-- Two minimal changes, bodies otherwise copied VERBATIM from the live versions:
--   1. start_quiz_attempt (3-arg, from 0042): replace the is_manager() guard
--      with a signed-in check. Locale + retake-pool fallback + attempt-reuse all
--      preserved exactly.
--   2. submit_quiz_attempt (from 0026): the 3-strike grading is unchanged, but
--      the 'at-risk' profile flag is now only applied when the taker is a manager
--      (so a lead/admin who fails a test quiz is never mislabeled at-risk).
-- Both functions keep their exact signatures — no new overloads.
-- ============================================================================

create or replace function public.start_quiz_attempt(
  p_module_slug text,
  p_pool        question_pool,
  p_locale      text default 'en'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id     uuid;
  v_attempt_status attempt_status;
  v_module         public.modules%rowtype;
  v_delivery_id    uuid;
  v_payload        json;
  v_es             boolean := (p_locale = 'es');
begin
  -- Any signed-in user may take a quiz (managers, leads, admins). Role-specific
  -- behaviour (e.g. at-risk flagging) is handled in submit_quiz_attempt.
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_module from public.modules where slug = p_module_slug;
  if not found then raise exception 'Module % not found', p_module_slug; end if;
  if v_module.status <> 'published' then raise exception 'Module % is not published', p_module_slug; end if;

  select id into v_delivery_id
    from public.module_deliveries
   where module_slug = p_module_slug and ended_at is null
   order by delivery_index desc
   limit 1;

  -- Reuse a non-terminal attempt for this pool + delivery (resume in-progress,
  -- or consume a scheduled retake) instead of inserting a duplicate. Prefer an
  -- already in-progress attempt so re-opening the quiz never forks a new row.
  select id, status into v_attempt_id, v_attempt_status
    from public.attempts
   where manager_id  = auth.uid()
     and module_slug = p_module_slug
     and pool        = p_pool
     and status in ('in-progress', 'scheduled')
     and delivery_id is not distinct from v_delivery_id
   order by (status = 'in-progress') desc, created_at desc
   limit 1;

  if v_attempt_id is not null then
    if v_attempt_status = 'scheduled' then
      update public.attempts
         set status = 'in-progress', started_at = now(), total_count = v_module.question_count
       where id = v_attempt_id;
    end if;
  else
    insert into public.attempts (manager_id, module_slug, delivery_id, pool, status, total_count)
    values (auth.uid(), p_module_slug, v_delivery_id, p_pool, 'in-progress', v_module.question_count)
    returning id into v_attempt_id;
  end if;

  -- Pick the question SET (ids only; the payload below re-joins to read text/text_es).
  -- First-attempt: deterministic single-pool pick. Retake: prioritise retake-pool
  -- questions, then random-fill from the first-attempt pool so an empty/short
  -- retake pool never serves zero questions.
  with retake_q as (
    select q.id, 0 as prio, extract(epoch from q.created_at)::float8 as ord_key, q.id::text as ord_tie
      from public.questions q
     where q.module_slug = p_module_slug
       and q.pool        = 'retake'
       and q.status      in ('approved', 'edited')
  ),
  fill_q as (
    select q.id, 1 as prio, random()::float8 as ord_key, q.id::text as ord_tie
      from public.questions q
     where q.module_slug = p_module_slug
       and q.pool        = 'first-attempt'
       and q.status      in ('approved', 'edited')
       and not exists (select 1 from retake_q r where r.id = q.id)
  ),
  first_q as (
    select q.id, 0 as prio, extract(epoch from q.created_at)::float8 as ord_key, q.id::text as ord_tie
      from public.questions q
     where q.module_slug = p_module_slug
       and q.pool        = 'first-attempt'
       and q.status      in ('approved', 'edited')
  ),
  picked as (
    select id
      from (
        select id, prio, ord_key, ord_tie from retake_q where p_pool = 'retake'
        union all
        select id, prio, ord_key, ord_tie from fill_q   where p_pool = 'retake'
        union all
        select id, prio, ord_key, ord_tie from first_q  where p_pool <> 'retake'
      ) u
     order by prio, ord_key, ord_tie
     limit v_module.question_count
  )
  select json_build_object(
    'attempt_id', v_attempt_id,
    'time_limit_minutes', v_module.time_limit_minutes,
    'questions', (
      select coalesce(json_agg(json_build_object(
        'id', q.id,
        'text', case when v_es then coalesce(q.text_es, q.text) else q.text end,
        'options', (
          select coalesce(json_agg(json_build_object(
            'id',    o.id,
            'text',  case when v_es then coalesce(o.text_es, o.text) else o.text end,
            'order', o."order"
          ) order by random()), '[]'::json)
          from public.question_options o
          where o.question_id = q.id
        )
      ) order by random()), '[]'::json)
      from picked p
      join public.questions q on q.id = p.id
    )
  ) into v_payload;

  return v_payload;
end;
$$;


create or replace function public.submit_quiz_attempt(
  p_attempt_id uuid,
  p_answers    jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt        public.attempts%rowtype;
  v_module         public.modules%rowtype;
  v_correct_count  int := 0;
  v_total_count    int := 0;
  v_score_pct      numeric(5, 2);
  v_passed         boolean;
  v_answer         jsonb;
  v_correct        boolean;
  v_duration_sec   int;
  v_failed_count   int := 0;
  v_locked         boolean := false;
  v_max_strikes    constant int := 3;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id;
  if not found then raise exception 'Attempt % not found', p_attempt_id; end if;
  if v_attempt.manager_id <> auth.uid() then raise exception 'Not your attempt'; end if;
  if v_attempt.status <> 'in-progress' then raise exception 'Attempt already submitted'; end if;

  select * into v_module from public.modules where slug = v_attempt.module_slug;

  v_total_count := jsonb_array_length(p_answers);

  for v_answer in select * from jsonb_array_elements(p_answers) loop
    select coalesce(o.correct, false) into v_correct
      from public.question_options o
     where o.id = (v_answer ->> 'selected_option_id')::uuid;

    insert into public.attempt_answers (attempt_id, question_id, selected_option_id, correct)
    values (
      p_attempt_id,
      (v_answer ->> 'question_id')::uuid,
      nullif(v_answer ->> 'selected_option_id', '')::uuid,
      coalesce(v_correct, false)
    )
    on conflict (attempt_id, question_id) do update
      set selected_option_id = excluded.selected_option_id,
          correct            = excluded.correct;

    if coalesce(v_correct, false) then
      v_correct_count := v_correct_count + 1;
    end if;
  end loop;

  v_score_pct := case when v_total_count > 0
                   then round((v_correct_count::numeric / v_total_count) * 100, 2)
                   else 0
                end;
  v_passed       := v_score_pct >= (v_module.pass_threshold * 100);
  v_duration_sec := extract(epoch from (now() - v_attempt.started_at))::int;

  update public.attempts
     set status        = case when v_passed then 'passed'::attempt_status else 'failed'::attempt_status end,
         submitted_at  = now(),
         score_pct     = v_score_pct,
         correct_count = v_correct_count,
         total_count   = v_total_count,
         duration_sec  = v_duration_sec
   where id = p_attempt_id;

  insert into public.activity (kind, actor_id, target_id, message)
  values (
    case when v_passed then 'quiz_passed'::activity_kind else 'quiz_failed'::activity_kind end,
    auth.uid(),
    null,
    case when v_passed
      then format('Passed %s with %s%%', v_module.title, v_score_pct)
      else format('Failed %s — %s%%', v_module.title, v_score_pct)
    end
  );

  if not v_passed then
    -- Count fails in this delivery window (includes the one just recorded).
    select count(*) into v_failed_count
      from public.attempts
     where manager_id  = v_attempt.manager_id
       and module_slug = v_attempt.module_slug
       and status      = 'failed'
       and delivery_id is not distinct from v_attempt.delivery_id;

    if v_failed_count >= v_max_strikes then
      -- Out of attempts: lock + flag. No more scheduled retakes.
      v_locked := true;
      -- Only flag managers as at-risk (leads/admins taking a test quiz are exempt).
      update public.profiles set status = 'at-risk' where id = v_attempt.manager_id and role = 'manager';
      insert into public.activity (kind, actor_id, target_id, message)
      values ('manager_flagged', auth.uid(), v_attempt.manager_id,
              format('Out of attempts — failed %s %s times', v_module.title, v_failed_count));
    else
      -- Flag at-risk as a warning from the 2nd failure onward (managers only).
      if v_failed_count >= 2 then
        update public.profiles set status = 'at-risk' where id = v_attempt.manager_id and role = 'manager';
      end if;
      -- Schedule one retake if none is already pending for this delivery.
      if not exists (
        select 1 from public.attempts
         where manager_id  = v_attempt.manager_id
           and module_slug = v_attempt.module_slug
           and pool        = 'retake'
           and status      = 'scheduled'
           and delivery_id is not distinct from v_attempt.delivery_id
      ) then
        insert into public.attempts (manager_id, module_slug, delivery_id, pool, status, total_count)
        values (v_attempt.manager_id, v_attempt.module_slug, v_attempt.delivery_id, 'retake', 'scheduled', v_module.question_count);
        insert into public.activity (kind, actor_id, target_id, message)
        values ('retake_scheduled', auth.uid(), null, format('Retake scheduled for %s', v_module.title));
      end if;
    end if;
  end if;

  return json_build_object(
    'attempt_id',         p_attempt_id,
    'score_pct',          v_score_pct,
    'correct_count',      v_correct_count,
    'total_count',        v_total_count,
    'passed',             v_passed,
    'locked',             v_locked,
    'attempts_remaining', greatest(0, v_max_strikes - v_failed_count)
  );
end;
$$;

-- ============================================================================
-- END OF MIGRATION 0043
-- ============================================================================
