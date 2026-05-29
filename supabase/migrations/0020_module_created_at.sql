-- Record when each module was created (used in admin displays so a Dept Lead
-- can see how old a module is). Existing rows have no real timestamp, so we
-- back-fill from the first delivery's started_at when available, else now().

alter table public.modules
  add column if not exists created_at timestamptz not null default now();

-- Back-fill any existing rows that were inserted before this column existed.
update public.modules m
   set created_at = coalesce((
     select min(d.started_at)
       from public.module_deliveries d
      where d.module_slug = m.slug
   ), now())
 where m.created_at = (select min(created_at) from public.modules);
