-- ============================================================================
-- BCJ Learn — Migration 0017: cached AI source text per module
-- ----------------------------------------------------------------------------
-- Holds the combined extracted text (and/or AI summary) of a module's uploaded
-- content, so the staged generation pipeline can extract/transcribe once and
-- then generate question batches from the cached source.
-- ============================================================================

alter table public.modules
  add column if not exists ai_source_text text;

-- ============================================================================
-- END OF MIGRATION 0017
-- ============================================================================
