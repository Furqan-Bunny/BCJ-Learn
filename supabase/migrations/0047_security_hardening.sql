-- ============================================================================
-- BCJ Learn — Migration 0047: security hardening (pre go-live)
-- ----------------------------------------------------------------------------
-- Closes authorization gaps found in a full audit. These are RLS / column-grant
-- backstops so a user can't bypass the app by crafting raw PostgREST calls with
-- their own JWT. App-side guards remain as the first line; these are the second.
-- ============================================================================

-- 1. PRIVILEGE ESCALATION — a user could update their OWN profile row's role to
--    'admin' (the "profiles: self update" RLS policy is row-level, not column-
--    level). Revoke column UPDATE on the sensitive columns from normal users;
--    only admin server actions (which use the service-role client) may change
--    them. Self-edit of name/phone/bio/prefs/2FA is unaffected.
revoke update (role, status, invite_token) on public.profiles from authenticated, anon;

-- 2. INVITE HIJACK — invite_token lives on profiles, and "profiles: teacher read"
--    lets a teacher read EVERY profile row. A teacher could read a pending
--    invitee's token and accept the invite (set its password) before the real
--    person. Stop authenticated reads of the token column entirely; only the
--    service-role invite flow reads it. (All app reads of invite_token already
--    go through the service-role client.)
revoke select (invite_token) on public.profiles from authenticated, anon;

-- 3. ANSWER-KEY LEAK — "questions: teacher read" / "question_options: teacher
--    read" were unscoped: ANY teacher could read every module's questions +
--    the `correct` flag (the exam answer key), not just modules they own.
--    Scope teacher SELECT to owned modules, matching the CUD policies.
drop policy if exists "questions: teacher read" on public.questions;
create policy "questions: teacher read" on public.questions for select
  using (public.is_teacher() and public.owns_module(module_slug));

drop policy if exists "question_options: teacher read" on public.question_options;
create policy "question_options: teacher read" on public.question_options for select
  using (
    public.is_teacher() and exists (
      select 1 from public.questions q
       where q.id = question_options.question_id
         and public.owns_module(q.module_slug)
    )
  );

-- 4. RESOURCE / SOP TAMPERING — "resources: teacher cud" let ANY teacher
--    create/edit/delete ANY SOP org-wide (and trigger a re-ack round for all
--    assigned users). Resource CRUD is admin-only in the app, so drop the
--    teacher write policy (teachers keep assignee read via "resources: assignee
--    read"). "module_resources: teacher all" let any teacher add/remove SOP
--    gates on ANY module; scope it to modules they own.
drop policy if exists "resources: teacher cud" on public.resources;

drop policy if exists "module_resources: teacher all" on public.module_resources;
create policy "module_resources: teacher own" on public.module_resources for all
  using (public.is_teacher() and public.owns_module(module_slug))
  with check (public.is_teacher() and public.owns_module(module_slug));

-- ============================================================================
-- END OF MIGRATION 0047
-- ============================================================================
