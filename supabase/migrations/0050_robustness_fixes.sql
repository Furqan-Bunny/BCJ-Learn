-- ============================================================================
-- BCJ Learn — Migration 0050: data-integrity / robustness fixes (pre go-live)
-- ----------------------------------------------------------------------------
-- Closes "stuck / orphaned / misleading state" holes found in a full audit.
-- Pairs with code-side fixes (reports/stats filters, lifecycle guards, invites).
-- ============================================================================

-- 1. ROSTER VIEW — latest_attempt_status / score / pool selected the latest row
--    with NO status filter, so an abandoned 'in-progress' or a pending
--    'scheduled' retake clobbered a manager's real result (a pass could vanish
--    from the roster). Scope the "latest attempt" to TERMINAL rows and prefer a
--    pass. Also exclude 'opted-out' invitees from the roster entirely.
create or replace view public.module_roster_view
with (security_invoker = on) as
select
  p.id              as manager_id,
  p.name,
  p.email,
  p.avatar_color,
  p.cohort,
  p.status          as profile_status,
  p.last_active_at,
  d.module_slug,
  d.id              as delivery_id,
  d.delivery_index,
  d.started_at      as delivery_started_at,
  d.scheduled_date  as delivery_scheduled_date,
  d.session_started_at,
  d.session_ended_at,
  greatest(
    d.started_at,
    coalesce(
      (select max(r.reset_at) from public.module_member_resets r
        where r.manager_id = p.id and r.module_slug = d.module_slug),
      '-infinity'::timestamptz)
  ) as effective_cutoff,
  -- Latest TERMINAL attempt (passed/failed), preferring a pass, since the
  -- cutoff. In-progress / scheduled rows never define the roster status.
  (select a.status from public.attempts a
    where a.manager_id = p.id and a.module_slug = d.module_slug
      and a.status in ('passed','failed')
      and a.started_at >= greatest(d.started_at,
        coalesce((select max(r.reset_at) from public.module_member_resets r
          where r.manager_id = p.id and r.module_slug = d.module_slug), '-infinity'::timestamptz))
    order by (a.status = 'passed') desc, a.started_at desc
    limit 1) as latest_attempt_status,
  (select a.score_pct from public.attempts a
    where a.manager_id = p.id and a.module_slug = d.module_slug
      and a.status in ('passed','failed')
      and a.started_at >= greatest(d.started_at,
        coalesce((select max(r.reset_at) from public.module_member_resets r
          where r.manager_id = p.id and r.module_slug = d.module_slug), '-infinity'::timestamptz))
    order by (a.status = 'passed') desc, a.started_at desc
    limit 1) as latest_score_pct,
  (select a.pool from public.attempts a
    where a.manager_id = p.id and a.module_slug = d.module_slug
      and a.status in ('passed','failed')
      and a.started_at >= greatest(d.started_at,
        coalesce((select max(r.reset_at) from public.module_member_resets r
          where r.manager_id = p.id and r.module_slug = d.module_slug), '-infinity'::timestamptz))
    order by (a.status = 'passed') desc, a.started_at desc
    limit 1) as latest_pool,
  exists (
    select 1 from public.attendance att
     where att.manager_id = p.id and att.delivery_id = d.id
  ) as checked_in,
  (select att.checked_in_at from public.attendance att
     where att.manager_id = p.id and att.delivery_id = d.id) as checked_in_at
from public.module_invitees mi
  join public.module_deliveries d on d.id = mi.delivery_id and d.ended_at is null
  join public.profiles          p on p.id = mi.manager_id
where mi.status <> 'opted-out';


-- 2. start_quiz_attempt — it inserted the 'in-progress' attempt row BEFORE
--    checking that any questions exist, so a module with no approved questions
--    left a permanent stray in-progress row (the bug seen on go-live). Add an
--    early guard that aborts (before any insert) when nothing is servable. Body
--    otherwise identical to 0043 (locale + retake fallback + attempt reuse).
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
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_module from public.modules where slug = p_module_slug;
  if not found then raise exception 'Module % not found', p_module_slug; end if;
  if v_module.status <> 'published' then raise exception 'Module % is not published', p_module_slug; end if;

  -- ABORT EARLY (before creating an attempt) if there are no servable questions
  -- for this pool. Retake can fall back to the first-attempt pool.
  if not exists (
    select 1 from public.questions q
     where q.module_slug = p_module_slug
       and q.status in ('approved','edited')
       and (q.pool = p_pool or (p_pool = 'retake' and q.pool = 'first-attempt'))
  ) then
    raise exception 'No approved questions are available for this module yet.';
  end if;

  select id into v_delivery_id
    from public.module_deliveries
   where module_slug = p_module_slug and ended_at is null
   order by delivery_index desc
   limit 1;

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

  with retake_q as (
    select q.id, 0 as prio, extract(epoch from q.created_at)::float8 as ord_key, q.id::text as ord_tie
      from public.questions q
     where q.module_slug = p_module_slug and q.pool = 'retake' and q.status in ('approved', 'edited')
  ),
  fill_q as (
    select q.id, 1 as prio, random()::float8 as ord_key, q.id::text as ord_tie
      from public.questions q
     where q.module_slug = p_module_slug and q.pool = 'first-attempt' and q.status in ('approved', 'edited')
       and not exists (select 1 from retake_q r where r.id = q.id)
  ),
  first_q as (
    select q.id, 0 as prio, extract(epoch from q.created_at)::float8 as ord_key, q.id::text as ord_tie
      from public.questions q
     where q.module_slug = p_module_slug and q.pool = 'first-attempt' and q.status in ('approved', 'edited')
  ),
  picked as (
    select id from (
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
            'id', o.id,
            'text', case when v_es then coalesce(o.text_es, o.text) else o.text end,
            'order', o."order"
          ) order by random()), '[]'::json)
          from public.question_options o where o.question_id = q.id
        )
      ) order by random()), '[]'::json)
      from picked p join public.questions q on q.id = p.id
    )
  ) into v_payload;

  return v_payload;
end;
$$;


-- 3. submit_quiz_attempt — reject an empty submission instead of recording a
--    bogus 0% fail that counts toward the 3-strike lockout. (Redefine 0043 body
--    with one extra guard.)
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

  if p_answers is null or jsonb_array_length(p_answers) = 0 then
    raise exception 'No answers submitted';
  end if;

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
    select count(*) into v_failed_count
      from public.attempts
     where manager_id  = v_attempt.manager_id
       and module_slug = v_attempt.module_slug
       and status      = 'failed'
       and delivery_id is not distinct from v_attempt.delivery_id;

    if v_failed_count >= v_max_strikes then
      v_locked := true;
      update public.profiles set status = 'at-risk' where id = v_attempt.manager_id and role = 'manager';
      insert into public.activity (kind, actor_id, target_id, message)
      values ('manager_flagged', auth.uid(), v_attempt.manager_id,
              format('Out of attempts — failed %s %s times', v_module.title, v_failed_count));
    else
      if v_failed_count >= 2 then
        update public.profiles set status = 'at-risk' where id = v_attempt.manager_id and role = 'manager';
      end if;
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


-- 4. track_last_active — flip a still-'pending' profile to 'active' on first real
--    sign-in. Closes the "stuck pending forever" state when a user sets a
--    password via the recovery link instead of the invite-accept flow.
create or replace function public.track_last_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles
       set last_active_at = new.last_sign_in_at,
           status         = case when status = 'pending' then 'active'::manager_status else status end,
           invite_token   = case when status = 'pending' then null else invite_token end
     where id = new.id;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- END OF MIGRATION 0050
-- ============================================================================
