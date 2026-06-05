-- ============================================================================
-- BCJ Learn — Migration 0037: Spanish columns for admin-authored content
-- ----------------------------------------------------------------------------
-- The titles/descriptions an employee actually reads (module + lesson +
-- lesson-content titles, resource title/description) get AI-translated and
-- cached in these *_es columns. All nullable; employee reads fall back to the
-- English value when a translation is missing. Long-form bodies and uploaded
-- documents are NOT auto-translated (BCJ supplies Spanish files where needed).
-- ============================================================================

alter table public.modules
  add column if not exists title_es       text,
  add column if not exists description_es text;

alter table public.lessons
  add column if not exists title_es       text,
  add column if not exists description_es text;

alter table public.lesson_contents
  add column if not exists title_es text;

alter table public.resources
  add column if not exists title_es       text,
  add column if not exists description_es text;

-- ============================================================================
-- END OF MIGRATION 0037
-- ============================================================================
