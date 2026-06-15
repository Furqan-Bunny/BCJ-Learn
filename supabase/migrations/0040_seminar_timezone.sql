-- ============================================================================
-- 0040 — Seminar time zone
-- ----------------------------------------------------------------------------
-- Scheduling now captures a time zone alongside the date + time so everyone
-- sees an unambiguous seminar time. Stored as an IANA zone string (e.g.
-- "America/New_York") on both the module (current/next seminar) and each
-- delivery. Nullable — falls back to no-zone display when absent.
-- ============================================================================

alter table public.modules            add column if not exists timezone text;
alter table public.module_deliveries  add column if not exists timezone text;
