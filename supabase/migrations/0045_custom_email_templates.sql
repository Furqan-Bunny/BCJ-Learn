-- ============================================================================
-- BCJ Learn — Migration 0045: admin-created custom email templates
-- ----------------------------------------------------------------------------
-- Per Nancy's Jun-16 request: admins should be able to CREATE a new email
-- template (not just edit the built-in ones) and send it to an audience.
--
-- email_templates.key is already the PK, so new (custom) keys are insertable and
-- RLS is already "admin all". This just adds metadata so the UI can distinguish
-- custom templates (deletable, with a friendly label) from the built-ins, and a
-- notification_kind so sends still log under a sensible bell category.
--   • is_custom         — true for admin-created templates (built-ins stay false).
--   • label             — friendly display name for custom keys.
--   • notification_kind — 'invitation' | 'reminder' | 'result' | 'alert'
--                         (defaults to 'reminder' at send time when null).
-- The automatic "when to send" trigger engine is intentionally a later phase;
-- for now custom templates are sent manually to a chosen audience.
-- ============================================================================

alter table public.email_templates
  add column if not exists is_custom boolean not null default false;

alter table public.email_templates
  add column if not exists label text;

alter table public.email_templates
  add column if not exists notification_kind text;

-- ============================================================================
-- END OF MIGRATION 0045
-- ============================================================================
