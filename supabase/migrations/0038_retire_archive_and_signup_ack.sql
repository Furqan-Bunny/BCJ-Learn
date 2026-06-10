-- ============================================================================
-- 0038 — Retire module "archive" + add sign-up acknowledgement to resources
-- ----------------------------------------------------------------------------
--  1. The Archive/Unarchive control was removed from the module edit UI in
--     favour of Publish / Unpublish (draft). Any module currently sitting in
--     'archived' is moved back to 'draft' so it isn't stranded (it's still
--     hidden from employees and can be re-published). The 'archived' enum
--     value is intentionally kept (Postgres can't easily drop enum values and
--     the status badge still renders legacy rows).
--
--  2. Resources can now be flagged as required at sign-up: when true (and
--     requires_ack is also true) the user must read & acknowledge the resource
--     via the onboarding gate before they can use the app. This is independent
--     of module_resources (which gates a specific module's quiz).
-- ============================================================================

update public.modules
   set status = 'draft'
 where status = 'archived';

alter table public.resources
  add column if not exists signup_ack boolean not null default false;
