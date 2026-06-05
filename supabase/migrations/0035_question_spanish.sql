-- ============================================================================
-- BCJ Learn — Migration 0035: Spanish columns for quiz content
-- ----------------------------------------------------------------------------
-- Employees can switch the app (and their quiz) to Spanish. Quiz CONTENT is
-- AI-translated and cached in these *_es columns. They are nullable; when a
-- translation is missing the quiz RPC falls back to the English text, so the
-- quiz never breaks regardless of translation coverage.
-- ============================================================================

alter table public.questions
  add column if not exists text_es        text,
  add column if not exists explanation_es text;

alter table public.question_options
  add column if not exists text_es text;

-- ============================================================================
-- END OF MIGRATION 0035
-- ============================================================================
