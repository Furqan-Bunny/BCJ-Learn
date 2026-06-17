-- ============================================================================
-- BCJ Learn — Migration 0051: retake lifecycle
--  • overdue-retake detection data on the roster view
--  • configurable "remind about retakes after N days" setting
--  • clear the at-risk flag when a manager passes (incl. on a retake)
--  • make the 3-strike lock honor resets so an admin "unlock" actually works
-- Pairs with code: cron overdue-retake pass, startQuiz reset-scoped lock count,
-- resetManagerForModule unlock cleanup.
-- ============================================================================

-- 1. SETTING — how many days after a failure before we flag/remind about the
--    un-taken retake. Separate from overdue_days (initial "never took the quiz").
alter table public.reminder_rules
  add column if not exists retake_overdue_days int not null default 7
    check (retake_overdue_days >= 1 and retake_overdue_days <= 90);


-- 2. ROSTER VIEW — same as 0050, plus two columns the overdue-retake detection
--    needs: the timestamp of the latest terminal attempt, and how many failures
--    have happened since the effective cutoff (1-2 = retakeable, >=3 = locked).
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
     where att.manager_id = p.id and att.delivery_id = d.id) as checked_in_at,
  -- NEW columns are appended at the END so CREATE OR REPLACE keeps the existing
  -- column order (Postgres rejects reordering/renaming an existing view's columns).
  -- when the latest terminal attempt happened (submitted, else started):
  (select coalesce(a.submitted_at, a.started_at) from public.attempts a
    where a.manager_id = p.id and a.module_slug = d.module_slug
      and a.status in ('passed','failed')
      and a.started_at >= greatest(d.started_at,
        coalesce((select max(r.reset_at) from public.module_member_resets r
          where r.manager_id = p.id and r.module_slug = d.module_slug), '-infinity'::timestamptz))
    order by (a.status = 'passed') desc, a.started_at desc
    limit 1) as latest_attempt_at,
  -- failures since the effective cutoff (the live strike count):
  (select count(*) from public.attempts a
    where a.manager_id = p.id and a.module_slug = d.module_slug
      and a.status = 'failed'
      and a.started_at >= greatest(d.started_at,
        coalesce((select max(r.reset_at) from public.module_member_resets r
          where r.manager_id = p.id and r.module_slug = d.module_slug), '-infinity'::timestamptz))
  ) as failed_count
from public.module_invitees mi
  join public.module_deliveries d on d.id = mi.delivery_id and d.ended_at is null
  join public.profiles          p on p.id = mi.manager_id
where mi.status <> 'opted-out';


-- 3. submit_quiz_attempt — same as 0050, with TWO changes:
--    (a) the 3-strike failure count now also requires started_at >= the manager's
--        reset cutoff, so an admin reset genuinely grants fresh attempts (the lock
--        is consistent with the open-gate, which is fixed in startQuiz to match).
--    (b) on a PASS, clear an at-risk flag so a fail-then-pass manager isn't stuck
--        flagged forever.
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
  v_cutoff         timestamptz;
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

  -- Effective cutoff for this manager+module: the later of the delivery start and
  -- the most recent admin reset. Failures before it don't count toward the lock.
  select greatest(
           coalesce((select d.started_at from public.module_deliveries d
                      where d.id = v_attempt.delivery_id), '-infinity'::timestamptz),
           coalesce((select max(r.reset_at) from public.module_member_resets r
                      where r.manager_id = v_attempt.manager_id
                        and r.module_slug = v_attempt.module_slug), '-infinity'::timestamptz)
         )
    into v_cutoff;

  if v_passed then
    -- Passing (including on a retake) clears the at-risk flag.
    update public.profiles
       set status = 'active'
     where id = v_attempt.manager_id and role = 'manager' and status = 'at-risk';
  else
    select count(*) into v_failed_count
      from public.attempts
     where manager_id  = v_attempt.manager_id
       and module_slug = v_attempt.module_slug
       and status      = 'failed'
       and delivery_id is not distinct from v_attempt.delivery_id
       and started_at >= v_cutoff;

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

-- ============================================================================
-- END OF MIGRATION 0051
-- ============================================================================
