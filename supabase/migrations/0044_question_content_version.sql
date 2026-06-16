-- ============================================================================
-- BCJ Learn — Migration 0044: tie AI questions to a module content version
-- ----------------------------------------------------------------------------
-- Problem (Nancy, Jun-16): editing a module's content does not touch its
-- questions, and generating more questions only ever INSERTS (never removes), so
-- questions from every past content version pile up (~78 in one module) with no
-- way to tell which belong to the current content.
--
-- This adds a precise content-version stamp:
--   • modules.content_version       — bumped each time content is saved.
--   • questions.source_content_version — the modules.content_version in effect
--                                        when the question was generated.
-- A question is "older content" when source_content_version < modules.content_version.
--
-- Backfill is conservative: existing questions are stamped with the module's
-- CURRENT version so nothing is flagged "older" today; only the NEXT content edit
-- bumps the module version and makes pre-existing questions show as older.
-- ============================================================================

alter table public.modules
  add column if not exists content_version int not null default 1;

alter table public.questions
  add column if not exists source_content_version int;

-- Stamp existing questions with their module's current content_version (treat all
-- current questions as "current" until the next content edit).
update public.questions q
   set source_content_version = m.content_version
  from public.modules m
 where q.module_slug = m.slug
   and q.source_content_version is null;

-- ============================================================================
-- END OF MIGRATION 0044
-- ============================================================================
