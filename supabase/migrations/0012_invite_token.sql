-- ============================================================================
-- BCJ Learn — Migration 0012: self-contained invite token
-- ----------------------------------------------------------------------------
-- The invite/accept flow no longer relies on Supabase's email link / redirect /
-- session. Instead inviteUser stores a random `invite_token` on the profile and
-- emails a /auth/accept-invite?token=… link via Resend. acceptInvite validates
-- the token server-side, sets the password, and flips status to 'active'.
--
-- Also reverts track_last_active() to last-active-only: a user becomes 'active'
-- ONLY when they set their password (acceptInvite), never just by signing in.
-- (0010 had made it flip pending->active on sign-in, which activated invitees
-- the moment they clicked the link — before setting any password.)
-- ============================================================================

alter table public.profiles
  add column if not exists invite_token text;

create index if not exists profiles_invite_token_idx on public.profiles (invite_token);

create or replace function public.track_last_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles
       set last_active_at = new.last_sign_in_at
     where id = new.id;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- END OF MIGRATION 0012
-- ============================================================================
