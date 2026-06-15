-- ============================================================================
-- BCJ Learn — Migration 0041: retake pool falls back to the first-attempt pool
-- ----------------------------------------------------------------------------
-- Problem (demo feedback, Jun 11): if an admin approves questions only into the
-- first-attempt pool and leaves the 'retake' pool empty, a manager who fails is
-- served pool='retake' and sees ZERO questions ("No approved questions").
--
-- Fix: when serving the retake pool, PRIORITISE any retake-pool questions, then
-- fill the remainder with a RANDOM sample of approved first-attempt questions,
-- up to question_count. The first-attempt pool keeps its deterministic pick
-- (same set for everyone). Only start_quiz_attempt's question selection changes;
-- attempt-row reuse and submit_quiz_attempt (3-strike) logic are unchanged.
-- ============================================================================

create or replace function public.start_quiz_attempt(
  p_module_slug text,
  p_pool        question_pool
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id  uuid;
  v_module      public.modules%rowtype;
  v_delivery_id uuid;
  v_payload     json;
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

  -- Reuse a pending scheduled retake for this pool + delivery (consume it),
  -- otherwise start a fresh attempt.
  select id into v_attempt_id
    from public.attempts
   where manager_id = auth.uid()
     and module_slug = p_module_slug
     and pool = p_pool
     and status = 'scheduled'
     and delivery_id is not distinct from v_delivery_id
   order by created_at desc
   limit 1;

  if v_attempt_id is not null then
    update public.attempts
       set status = 'in-progress', started_at = now(), total_count = v_module.question_count
     where id = v_attempt_id;
  else
    insert into public.attempts (manager_id, module_slug, delivery_id, pool, status, total_count)
    values (auth.uid(), p_module_slug, v_delivery_id, p_pool, 'in-progress', v_module.question_count)
    returning id into v_attempt_id;
  end if;

  -- Pick the question SET. First-attempt: deterministic (same set for everyone),
  -- order/options randomized on output. Retake: prioritise retake-pool questions,
  -- then random-fill from the first-attempt pool so an empty/short retake pool
  -- never serves zero questions.
  -- ord_key sorts WITHIN a prio group only (prio is the primary sort), so the
  -- scales never mix: retake/first-attempt use created_at epoch (deterministic,
  -- same set for everyone); the fill rows use random() (a true random sample).
  with retake_q as (
    select q.id, q.text, q.explanation,
           0 as prio, extract(epoch from q.created_at)::float8 as ord_key, q.id::text as ord_tie
      from public.questions q
     where q.module_slug = p_module_slug
       and q.pool        = 'retake'
       and q.status      in ('approved', 'edited')
  ),
  fill_q as (
    select q.id, q.text, q.explanation,
           1 as prio, random()::float8 as ord_key, q.id::text as ord_tie
      from public.questions q
     where q.module_slug = p_module_slug
       and q.pool        = 'first-attempt'
       and q.status      in ('approved', 'edited')
       and not exists (select 1 from retake_q r where r.id = q.id)
  ),
  first_q as (
    select q.id, q.text, q.explanation,
           0 as prio, extract(epoch from q.created_at)::float8 as ord_key, q.id::text as ord_tie
      from public.questions q
     where q.module_slug = p_module_slug
       and q.pool        = 'first-attempt'
       and q.status      in ('approved', 'edited')
  ),
  picked as (
    select id, text, explanation
      from (
        -- Retake pool: retake questions first (prio 0), then random first-attempt fill (prio 1).
        select id, text, explanation, prio, ord_key, ord_tie from retake_q where p_pool = 'retake'
        union all
        select id, text, explanation, prio, ord_key, ord_tie from fill_q   where p_pool = 'retake'
        -- First-attempt pool: deterministic single-pool pick.
        union all
        select id, text, explanation, prio, ord_key, ord_tie from first_q  where p_pool <> 'retake'
      ) u
     order by prio, ord_key, ord_tie
     limit v_module.question_count
  )
  select json_build_object(
    'attempt_id', v_attempt_id,
    'time_limit_minutes', v_module.time_limit_minutes,
    'questions', (
      select coalesce(json_agg(json_build_object(
        'id', p.id,
        'text', p.text,
        'options', (
          select coalesce(json_agg(json_build_object(
            'id',    o.id,
            'text',  o.text,
            'order', o."order"
          ) order by random()), '[]'::json)
          from public.question_options o
          where o.question_id = p.id
        )
      ) order by random()), '[]'::json)
      from picked p
    )
  ) into v_payload;

  return v_payload;
end;
$$;

-- ============================================================================
-- END OF MIGRATION 0041
-- ============================================================================
