-- ============================================================================
-- BCJ Learn — Phone number + notification preferences on profiles
-- ----------------------------------------------------------------------------
-- Adds:
--   • profiles.phone               — optional contact phone; admins can see it
--   • profiles.notification_prefs  — JSONB toggle map for opt-outable emails
--   • profiles_phone_safe_chars    — CHECK constraint defanging CSV-injection
--                                    payloads from direct Studio edits
-- ============================================================================

alter table public.profiles
  add column if not exists phone              text,
  add column if not exists notification_prefs jsonb not null
    default '{"quiz_results": true, "training_reminders": true, "at_risk_alerts": true}'::jsonb;

-- DB-level guard: leading formula chars rejected at insert/update. Mirrors the
-- JS-side check in updateProfile; defence-in-depth for direct Supabase Studio
-- edits or admin updates that bypass the server action.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'profiles_phone_safe_chars'
       and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_phone_safe_chars
      check (phone is null or phone !~ '^[=+\-@\t\r]');
  end if;
end $$;

-- No RLS changes — the existing "profiles: self update" + "profiles: admin all"
-- policies in migration 0001 cover the new columns automatically.

-- ============================================================================
-- END OF MIGRATION 0005
-- ============================================================================
