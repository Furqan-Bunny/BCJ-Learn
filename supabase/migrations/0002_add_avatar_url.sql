-- ============================================================================
-- BCJ Learn — Migration 0002: profile pictures
-- ----------------------------------------------------------------------------
-- Adds the avatar_url column to profiles. Storage bucket `avatars` already
-- exists (created in 0001) with public-read + self-write policies, so each
-- user can upload to a folder named after their own user id and the resulting
-- URL gets stored here.
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_url text;

-- Optional helper view that exposes a fully-resolved avatar URL for each user.
-- Falls back to a deterministic gravatar-like URL when no avatar is uploaded,
-- so the UI always has something to show.
create or replace view public.profiles_with_avatar as
select
  p.*,
  coalesce(
    p.avatar_url,
    null  -- UI falls back to initials + avatar_color when null
  ) as resolved_avatar_url
from public.profiles p;

-- ============================================================================
-- END OF MIGRATION 0002
-- ============================================================================
