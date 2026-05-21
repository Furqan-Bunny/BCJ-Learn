-- ============================================================================
-- BCJ Learn — Migration 0008: content version history + video watch progress
-- ----------------------------------------------------------------------------
-- Two additive tables:
--   1. module_content_versions — a JSON snapshot of a module's whole lessons +
--      contents tree, taken before each save (and before a restore). Module-
--      level because saving lessons deletes + re-inserts rows with new IDs, so
--      per-row versioning isn't possible.
--   2. video_progress — per-manager playback position / completion for uploaded
--      lesson videos, so viewers can resume and completion can be tracked.
--
-- Writes happen via the service-role admin client in server actions (bypasses
-- RLS); the policies below govern reads.
-- ============================================================================

-- ─── 1. module_content_versions ───────────────────────────────────────────
create table public.module_content_versions (
  id              uuid primary key default gen_random_uuid(),
  module_slug     text not null references public.modules (slug) on delete cascade,
  version_number  int  not null,
  snapshot        jsonb not null,            -- [{order,title,description,durationMinutes,contents:[...]}]
  change_reason   text not null,             -- 'edited' | 'restored'
  changed_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (module_slug, version_number)
);

create index module_content_versions_idx
  on public.module_content_versions (module_slug, version_number desc);

alter table public.module_content_versions enable row level security;

create policy "mcv: admin all" on public.module_content_versions for all
  using (public.is_admin()) with check (public.is_admin());

create policy "mcv: teacher read own" on public.module_content_versions for select
  using (public.is_teacher() and public.owns_module(module_slug));


-- ─── 2. video_progress ─────────────────────────────────────────────────────
create table public.video_progress (
  manager_id        uuid not null references public.profiles (id) on delete cascade,
  lesson_content_id uuid not null references public.lesson_contents (id) on delete cascade,
  module_slug       text references public.modules (slug) on delete set null,
  position_sec      int  not null default 0,
  duration_sec      int  not null default 0,
  watch_pct         numeric(5, 2) not null default 0,
  completed_at      timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (manager_id, lesson_content_id)
);

create index video_progress_manager_idx on public.video_progress (manager_id);

alter table public.video_progress enable row level security;

create policy "vp: self all" on public.video_progress for all
  using (manager_id = auth.uid()) with check (manager_id = auth.uid());

create policy "vp: admin read" on public.video_progress for select
  using (public.is_admin());

create policy "vp: teacher read own" on public.video_progress for select
  using (public.is_teacher() and public.owns_module(module_slug));

-- ============================================================================
-- END OF MIGRATION 0008
-- ============================================================================
