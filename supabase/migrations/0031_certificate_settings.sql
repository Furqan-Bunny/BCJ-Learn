-- Admin-editable completion-certificate template (singleton, id='global').
-- Lets BCJ fully customise the certificate wording + signatory without code
-- changes. Placeholders {{name}} {{module}} {{score}} {{date}} are substituted
-- at render time.

create table if not exists public.certificate_settings (
  id               text primary key default 'global',
  heading          text not null default 'Certificate of Completion',
  intro_line       text not null default 'This certifies that',
  completion_line  text not null default 'has successfully completed',
  org_name         text not null default 'BCJ Building Services',
  footer           text not null default 'BCJ Learn — Training Platform',
  signatory_name   text not null default '',
  signatory_title  text not null default '',
  show_logo        boolean not null default true,
  updated_by       uuid references public.profiles (id) on delete set null,
  updated_at       timestamptz not null default now()
);

insert into public.certificate_settings (id) values ('global')
  on conflict (id) do nothing;

alter table public.certificate_settings enable row level security;

-- Any authenticated user can read (employees render their own certificate);
-- only admins can write.
create policy "certificate_settings: read" on public.certificate_settings
  for select using (auth.role() = 'authenticated');
create policy "certificate_settings: admin write" on public.certificate_settings
  for all using (public.is_admin()) with check (public.is_admin());
