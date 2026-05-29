-- Record which content items each employee has actually viewed during a
-- delivery. The presenter uses this to keep the outline's "checked off" state
-- consistent across navigation and reloads (today it resets when you go back
-- because completion was only in React state).

create table if not exists public.content_views (
  id          uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.module_deliveries(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content_id  uuid not null references public.lesson_contents(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  unique (delivery_id, user_id, content_id)
);

create index if not exists content_views_delivery_user_idx
  on public.content_views (delivery_id, user_id);

alter table public.content_views enable row level security;

-- The owner (the viewer) can read + write their own rows; admins/teachers can
-- read for reporting.
create policy "content_views: viewer rw" on public.content_views
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "content_views: staff read" on public.content_views
  for select
  using (public.is_admin() or public.is_teacher());
