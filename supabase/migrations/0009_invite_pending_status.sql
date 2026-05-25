-- ============================================================================
-- BCJ Learn — Migration 0009: add 'pending' to manager_status
-- ----------------------------------------------------------------------------
-- Invited users should sit at 'pending' until they accept (set a password /
-- first sign-in), then flip to 'active'. Until now status was left NULL on
-- invite and the UI coalesced NULL -> 'active', so invited people looked active.
--
-- IMPORTANT: this is intentionally ALONE in its own migration. Postgres does
-- not allow a newly-added enum value to be USED in the same transaction it was
-- added in. Migration 0010 (which references 'pending') runs afterwards, once
-- this value is committed.
-- ============================================================================

alter type manager_status add value if not exists 'pending' before 'active';

-- ============================================================================
-- END OF MIGRATION 0009
-- ============================================================================
