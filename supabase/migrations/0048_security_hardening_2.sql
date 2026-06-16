-- ============================================================================
-- BCJ Learn — Migration 0048: security hardening, round 2
-- ----------------------------------------------------------------------------
-- Follow-ups to 0047: scope teacher profile reads, and add OTP brute-force
-- protection. Paired with code changes (guarded roster picker + OTP throttle).
-- ============================================================================

-- 1. PII OVER-EXPOSURE — "profiles: teacher read" was `using(is_teacher())`, so
--    any Department Lead could read EVERY profile (name/email/phone/status) by
--    id, including employees unrelated to their modules. Scope teacher reads to:
--      • staff (other leads + admins) — names appear as module owners, etc.
--      • managers who are an invitee of, or have an attempt on, a module the
--        lead OWNS (their actual roster / results).
--    The "Add employee to seminar" picker (which needs the full active roster)
--    now goes through a guarded server action using the service-role client.
drop policy if exists "profiles: teacher read" on public.profiles;
create policy "profiles: teacher read" on public.profiles for select
  using (
    public.is_teacher() and (
      role in ('teacher', 'admin')
      or exists (
        select 1 from public.attempts a
         where a.manager_id = profiles.id and public.owns_module(a.module_slug)
      )
      or exists (
        select 1 from public.module_invitees mi
          join public.module_deliveries d on d.id = mi.delivery_id
         where mi.manager_id = profiles.id and public.owns_module(d.module_slug)
      )
    )
  );

-- 2. OTP BRUTE FORCE — the 6-digit login code had no attempt limit within its
--    10-minute window. Add a counter; the app deletes the code after 5 wrong
--    tries (forcing a fresh request).
alter table public.email_otps
  add column if not exists attempts int not null default 0;

-- ============================================================================
-- END OF MIGRATION 0048
-- ============================================================================
