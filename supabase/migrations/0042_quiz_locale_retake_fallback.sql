-- ============================================================================
-- BCJ Learn — Migration 0042: one canonical start_quiz_attempt
-- ----------------------------------------------------------------------------
-- Background: two overloads of start_quiz_attempt had drifted apart.
--   • 0036 dropped the 2-arg version and created a 3-arg (p_module_slug, p_pool,
--     p_locale) version — LOCALE-AWARE, but WITHOUT the retake-pool fallback.
--   • 0041 then `create or replace`d the 2-arg (p_module_slug, p_pool) version to
--     add the retake-pool fallback (empty 'retake' pool -> random-fill from
--     'first-attempt' so a failed employee never sees "No approved questions").
-- Because Postgres keys functions by argument signature, BOTH overloads coexisted.
-- The app (src/lib/server/quiz-actions.ts) always calls with p_locale, so it
-- resolved to the 3-arg version — meaning the 0041 retake fallback NEVER ran on
-- the live path.
--
-- Fix: merge BOTH features into the single 3-arg version the app calls, and DROP
-- the orphaned 2-arg version so no ambiguity / dead code remains.
--   • Attempt-reuse / de-dup block: unchanged from 0027/0036 (prefer in-progress,
--     promote a scheduled retake, else insert a fresh in-progress attempt).
--   • Question-SET pick: the 0041 retake fallback (retake questions first, then a
--     random sample of first-attempt questions up to question_count).
--   • Payload: locale-aware from 0036 — coalesce(text_es, text) when p_locale='es',
--     English fallback otherwise.
-- submit_quiz_attempt and schedule_redelivery are unchanged.
-- ============================================================================

-- Remove the orphaned 2-arg overload created by 0041 (its fix now lives in the
-- 3-arg version below).
drop function if exists public.start_quiz_attempt(text, question_pool);

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
  if not public.is_manager() then
    raise exception 'Only managers can start a quiz attempt';
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
      -- Promote a scheduled retake into an active attempt.
      update public.attempts
         set status = 'in-progress', started_at = now(), total_count = v_module.question_count
       where id = v_attempt_id;
    end if;
    -- An already in-progress attempt is reused as-is (keep its started_at).
  else
    insert into public.attempts (manager_id, module_slug, delivery_id, pool, status, total_count)
    values (auth.uid(), p_module_slug, v_delivery_id, p_pool, 'in-progress', v_module.question_count)
    returning id into v_attempt_id;
  end if;

  -- Pick the question SET (ids only; the payload below re-joins to read text/text_es).
  -- First-attempt: deterministic single-pool pick (same set for everyone), ordered
  -- by created_at epoch. Retake: prioritise retake-pool questions (prio 0,
  -- deterministic), then random-fill from the first-attempt pool (prio 1, random)
  -- so an empty/short retake pool never serves zero questions. ord_key sorts WITHIN
  -- a prio group only, so the deterministic and random scales never mix.
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

-- ============================================================================
-- END OF MIGRATION 0042
-- ============================================================================
