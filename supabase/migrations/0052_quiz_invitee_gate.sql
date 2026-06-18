-- ============================================================================
-- BCJ Learn — Migration 0052: quiz invitee gate (defense-in-depth)
-- ----------------------------------------------------------------------------
-- A MANAGER may only take a module's quiz if they're an invitee of the current
-- delivery, OR they already have an attempt on it (retake). Staff (admin/teacher)
-- bypass so "Take it yourself" keeps working. The app already enforces this in
-- canStartQuizNow, but the RPC is callable directly, so we gate it here too.
-- Body otherwise identical to 0050's start_quiz_attempt.
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
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into v_module from public.modules where slug = p_module_slug;
  if not found then raise exception 'Module % not found', p_module_slug; end if;
  if v_module.status <> 'published' then raise exception 'Module % is not published', p_module_slug; end if;

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

  -- INVITEE GATE (new in 0052): managers must be invited to the current delivery,
  -- or already have an attempt (retake). Staff bypass.
  if (select role from public.profiles where id = auth.uid()) = 'manager' then
    if not exists (
      select 1 from public.module_invitees mi
       where mi.delivery_id = v_delivery_id and mi.manager_id = auth.uid()
    ) and not exists (
      select 1 from public.attempts a
       where a.manager_id = auth.uid() and a.module_slug = p_module_slug
    ) then
      raise exception 'You are not on the invite list for this module.';
    end if;
  end if;

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

-- ============================================================================
-- END OF MIGRATION 0052
-- ============================================================================
