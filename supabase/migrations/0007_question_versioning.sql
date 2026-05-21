-- ============================================================================
-- BCJ Learn — Migration 0007: question version history
-- ----------------------------------------------------------------------------
-- Until now, editing or regenerating a question OVERWROTE its text + options
-- with no history. This adds a snapshot table so every change is preserved and
-- a previous version can be restored.
--
-- Snapshots are written by SECURITY-context server actions using the
-- service-role client (which bypasses RLS); the policies below govern READS:
-- admins see all, teachers see versions for modules they own, and a manager
-- never reads question content directly (quiz flow stays via the existing
-- SECURITY DEFINER functions).
-- ============================================================================

create table public.question_versions (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references public.questions (id) on delete cascade,
  version_number  int  not null,
  text            text not null,
  explanation     text,
  options         jsonb not null default '[]'::jsonb,  -- [{text, correct, order}, ...]
  status          question_status not null,            -- status at snapshot time
  change_reason   text not null,                       -- 'initial'|'edited'|'regenerated'|'approved'|'restored'
  changed_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (question_id, version_number)
);

create index question_versions_q_idx
  on public.question_versions (question_id, version_number desc);

alter table public.question_versions enable row level security;

create policy "question_versions: admin all"
  on public.question_versions for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "question_versions: teacher read own"
  on public.question_versions for select
  using (
    public.is_teacher()
    and exists (
      select 1 from public.questions q
      where q.id = question_versions.question_id
        and public.owns_module(q.module_slug)
    )
  );

-- ============================================================================
-- END OF MIGRATION 0007
-- ============================================================================
