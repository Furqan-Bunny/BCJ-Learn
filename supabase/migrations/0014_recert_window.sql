-- ============================================================================
-- BCJ Learn — Migration 0014: 12-month recertification window on re-delivery
-- ----------------------------------------------------------------------------
-- Redefines schedule_redelivery so a new seminar auto-invites only the employees
-- who are DUE: active managers who have NOT passed this module in the last
-- 12 months. So new hires + past fails + anyone whose pass is >12 months old
-- (recert) are invited; anyone who passed within the last year is skipped.
-- (Previously it excluded anyone who had EVER passed, with no time window.)
-- ============================================================================

create or replace function public.schedule_redelivery(
  p_module_slug    text,
  p_new_start_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_delivery_id uuid;
  v_next_index      int;
begin
  if not (public.is_admin() or (public.is_teacher() and public.owns_module(p_module_slug))) then
    raise exception 'Not authorised to schedule re-delivery';
  end if;

  update public.module_deliveries
     set ended_at = now()
   where module_slug = p_module_slug
     and ended_at is null;

  select coalesce(max(delivery_index), 0) + 1 into v_next_index
    from public.module_deliveries
   where module_slug = p_module_slug;

  insert into public.module_deliveries (module_slug, delivery_index, scheduled_date)
  values (p_module_slug, v_next_index, p_new_start_date)
  returning id into v_new_delivery_id;

  -- Auto-invite the DUE: active employees with no PASS in the last 12 months.
  insert into public.module_invitees (delivery_id, manager_id, status)
  select v_new_delivery_id, p.id, 'invited'
    from public.profiles p
   where p.role = 'manager'
     and p.status not in ('inactive', 'pending')
     and not exists (
       select 1 from public.attempts a
        where a.manager_id  = p.id
          and a.module_slug = p_module_slug
          and a.status      = 'passed'
          and a.started_at  > now() - interval '12 months'
     );

  insert into public.activity (kind, actor_id, target_id, message)
  values ('delivery_rescheduled', auth.uid(), null,
          format('Seminar #%s scheduled for module %s', v_next_index, p_module_slug));

  return v_new_delivery_id;
end;
$$;

-- ============================================================================
-- END OF MIGRATION 0014
-- ============================================================================
