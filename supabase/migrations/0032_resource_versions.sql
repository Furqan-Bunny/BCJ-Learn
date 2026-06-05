-- Change-audit snapshots for resources (mirrors module_content_versions).
-- One row per create/edit so the admin resource detail page can show what
-- changed, when, and who edited it. `ack_version` records resources.version at
-- the time so the page can correlate edits with re-acknowledgement rounds.

create table if not exists public.resource_versions (
  id            uuid primary key default gen_random_uuid(),
  resource_id   uuid not null references public.resources (id) on delete cascade,
  seq           int  not null,                 -- 1,2,3… edit order
  ack_version   int  not null default 1,       -- resources.version at this point
  snapshot      jsonb not null,                -- full field snapshot
  change_reason text not null,                 -- 'created' | 'edited'
  changed_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (resource_id, seq)
);

create index if not exists resource_versions_resource_idx
  on public.resource_versions (resource_id, seq desc);

alter table public.resource_versions enable row level security;

-- Authenticated users can read; only admins write (writes go through the
-- service-role server actions anyway).
create policy "resource_versions: read" on public.resource_versions
  for select using (auth.role() = 'authenticated');
create policy "resource_versions: admin write" on public.resource_versions
  for all using (public.is_admin()) with check (public.is_admin());

-- Backfill a "created" v1 for every existing resource so history has a start.
insert into public.resource_versions (resource_id, seq, ack_version, snapshot, change_reason, changed_by, created_at)
select
  r.id,
  1,
  coalesce(r.version, 1),
  jsonb_build_object(
    'title', r.title,
    'category', r.category,
    'department', r.department,
    'description', r.description,
    'body', r.body,
    'storagePath', r.storage_path,
    'externalUrl', r.external_url,
    'requiresAck', r.requires_ack,
    'assignedRoles', r.assigned_roles,
    'assignedCohorts', r.assigned_cohorts
  ),
  'created',
  r.created_by,
  r.created_at
from public.resources r
where not exists (
  select 1 from public.resource_versions v where v.resource_id = r.id
);
