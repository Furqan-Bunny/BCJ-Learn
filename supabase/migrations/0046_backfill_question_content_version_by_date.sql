-- ============================================================================
-- BCJ Learn — Migration 0046: date-based backfill of question content versions
-- ----------------------------------------------------------------------------
-- Problem: 0044 added modules.content_version + questions.source_content_version
-- but backfilled every existing question to the module's CURRENT version, so a
-- module whose content was edited (and questions generated) BEFORE that migration
-- has all its questions looking "current" — old and new questions are
-- indistinguishable. (Nancy already edited content and generated new questions,
-- so her bank is mixed with no way to tell which came from the old content.)
--
-- Fix: recompute both columns from real timestamps. Each row in
-- module_content_versions is a content-replacement event (its created_at = the
-- moment the content changed). So:
--   • modules.content_version       = 1 + (number of content-change events).
--   • questions.source_content_version = 1 + (number of content-change events
--                                        at or before the question's created_at).
-- A question created before an edit gets a LOWER version than one created after,
-- so "older content" = source_content_version < modules.content_version now
-- correctly separates the pre-edit questions from the post-edit ones — purely by
-- date. This is a full recompute, so it is safe to re-run.
-- ============================================================================

-- 1. Current content version per module = 1 + number of content snapshots.
update public.modules m
   set content_version = 1 + coalesce((
     select count(*) from public.module_content_versions v
      where v.module_slug = m.slug
   ), 0);

-- 2. Each question's source version = 1 + number of content changes that
--    happened at or before it was created (date-based old-vs-new split).
update public.questions q
   set source_content_version = 1 + coalesce((
     select count(*) from public.module_content_versions v
      where v.module_slug = q.module_slug
        and v.created_at <= q.created_at
   ), 0);

-- ============================================================================
-- END OF MIGRATION 0046
-- ============================================================================
