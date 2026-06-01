-- Link SOPs (resources) to training modules. An employee must sign every
-- linked SOP before they can open the module materials or take the quiz.
--
-- Many-to-many: a single module can require several SOPs (e.g. Floor Care +
-- Chemical Handling + Safety) and a single SOP can be required by several
-- modules.

create table if not exists public.module_resources (
  module_slug text   not null references public.modules(slug)      on delete cascade,
  resource_id uuid   not null references public.resources(id)      on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (module_slug, resource_id)
);

create index if not exists module_resources_module_idx on public.module_resources (module_slug);
create index if not exists module_resources_resource_idx on public.module_resources (resource_id);

alter table public.module_resources enable row level security;

create policy "module_resources: admin all" on public.module_resources
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "module_resources: teacher all" on public.module_resources
  for all
  using (public.is_teacher())
  with check (public.is_teacher());

-- Authenticated users (employees) need to read the links so the manager
-- module page can know which SOPs to gate on.
create policy "module_resources: authed read" on public.module_resources
  for select
  using (auth.role() = 'authenticated');
