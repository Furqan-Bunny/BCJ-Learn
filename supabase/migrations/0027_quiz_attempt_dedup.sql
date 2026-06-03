-- ============================================================================
-- BCJ Learn — Migration 0027: stop double-counting attempts
-- ----------------------------------------------------------------------------
-- Bug: opening / starting the same quiz again created a SECOND 'in-progress'
-- attempt row, so one real usage showed as two attempts.
--
-- Fix: start_quiz_attempt now reuses ANY non-terminal attempt for this
-- (manager, module, pool, delivery) — a pending 'scheduled' retake OR an
-- existing 'in-progress' attempt — instead of inserting a duplicate. An
-- in-progress attempt is preferred (resume the active one); its started_at is
-- only reset when we promote a scheduled row.
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
  v_attempt_id     uuid;
  v_attempt_status attempt_status;
  v_module         public.modules%rowtype;
  v_delivery_id    uuid;
  v_payload        json;
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

  -- Deterministic SET (same questions for everyone), but randomized ORDER on
  -- output (and options) so two people side-by-side don't see the same order.
  with picked as (
    select q.id, q.text, q.explanation
      from public.questions q
     where q.module_slug = p_module_slug
       and q.pool        = p_pool
       and q.status      in ('approved', 'edited')
     order by q.created_at, q.id
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

-- ----------------------------------------------------------------------------
-- One-time cleanup: collapse pre-existing duplicate 'in-progress' attempts
-- left by the old behaviour. Keep the most recent per
-- (manager, module, pool, delivery); delete the older stragglers so historical
-- counts reflect one usage = one attempt. Only touches never-submitted rows.
-- ----------------------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by manager_id, module_slug, pool, delivery_id
           order by started_at desc nulls last, created_at desc
         ) as rn
    from public.attempts
   where status = 'in-progress'
)
delete from public.attempts
 where id in (select id from ranked where rn > 1);

-- ============================================================================
-- END OF MIGRATION 0027
-- ============================================================================
