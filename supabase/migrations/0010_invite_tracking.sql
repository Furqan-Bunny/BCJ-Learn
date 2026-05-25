-- ============================================================================
-- BCJ Learn — Migration 0010: invite timing + auto-activate on accept
-- ----------------------------------------------------------------------------
-- Adds invite_sent_at / invite_expires_at so the Employees screen can show when
-- an invite was sent and how long is left to accept (7-day window).
--
-- Also redefines track_last_active() so that when an invited ('pending') user
-- first signs in (i.e. accepts), their status auto-flips to 'active'. The
-- accept-invite page also sets this explicitly; the trigger is the backstop.
-- ('pending' is safe here — it was committed in migration 0009.)
-- ============================================================================

alter table public.profiles
  add column if not exists invite_sent_at    timestamptz,
  add column if not exists invite_expires_at timestamptz;

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
           status = case
             when status = 'pending' then 'active'::manager_status
             else status
           end
     where id = new.id;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- END OF MIGRATION 0010
-- ============================================================================
