-- ============================================================================
-- BCJ Learn — Settings + per-manager resets + roster view
-- ----------------------------------------------------------------------------
-- Goal: eliminate the remaining Zustand-only and mock-only state.
--
-- Adds:
--   1. branding_settings (singleton)  — platform name, colors, email-from, logo
--   2. reminder_rules    (singleton)  — auto-reminder toggle + overdue threshold
--   3. module_member_resets           — replaces Zustand `managerResetAt`
--   4. module_roster_view             — single source of truth for roster status
-- ============================================================================


-- ─── 1. branding_settings (singleton) ─────────────────────────────────────
create table public.branding_settings (
  id              text primary key default 'global' check (id = 'global'),
  name            text        not null default 'BCJ Learn',
  primary_color   text        not null default '#1F3A5F',
  accent_color    text        not null default '#C89B5C',
  email_from      text        not null default 'noreply@bcj.com',
  logo_path       text,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);

create trigger branding_settings_set_updated_at
  before update on public.branding_settings
  for each row execute function public.set_updated_at();


-- ─── 2. reminder_rules (singleton) ────────────────────────────────────────
create table public.reminder_rules (
  id              text primary key default 'global' check (id = 'global'),
  auto_reminders  boolean     not null default true,
  overdue_days    int         not null default 3 check (overdue_days >= 1 and overdue_days <= 30),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);

create trigger reminder_rules_set_updated_at
  before update on public.reminder_rules
  for each row execute function public.set_updated_at();


-- ─── 3. module_member_resets ──────────────────────────────────────────────
-- Records per-manager-per-module reset events. Replaces the Zustand
-- `managerResetAt` map. A reset means: ignore any attempts before this
-- timestamp when computing roster status for this manager in this module.
create table public.module_member_resets (
  id            uuid primary key default gen_random_uuid(),
  module_slug   text        not null references public.modules (slug) on delete cascade,
  manager_id    uuid        not null references public.profiles (id) on delete cascade,
  reset_at      timestamptz not null default now(),
  reset_by      uuid        references public.profiles (id) on delete set null,
  reason        text
);

create index module_member_resets_lookup
  on public.module_member_resets (module_slug, manager_id, reset_at desc);


-- ─── 4. Seed singletons ───────────────────────────────────────────────────
insert into public.branding_settings (id) values ('global') on conflict do nothing;
insert into public.reminder_rules    (id) values ('global') on conflict do nothing;


-- ─── 5. RLS ───────────────────────────────────────────────────────────────
alter table public.branding_settings   enable row level security;
alter table public.reminder_rules      enable row level security;
alter table public.module_member_resets enable row level security;

-- branding_settings: any authed user can read (header/logo on every page);
-- only admins can change.
create policy "branding: authed read"
  on public.branding_settings for select
  using (auth.role() = 'authenticated');

create policy "branding: admin write"
  on public.branding_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- reminder_rules: same pattern.
create policy "reminders: authed read"
  on public.reminder_rules for select
  using (auth.role() = 'authenticated');

create policy "reminders: admin write"
  on public.reminder_rules for all
  using (public.is_admin())
  with check (public.is_admin());

-- module_member_resets: admin OR teacher-of-this-module can read; admin writes.
create policy "resets: admin all"
  on public.module_member_resets for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "resets: teacher read own"
  on public.module_member_resets for select
  using (public.is_teacher() and public.owns_module(module_slug));

create policy "resets: self read"
  on public.module_member_resets for select
  using (manager_id = auth.uid());


-- ─── 6. module_roster_view ────────────────────────────────────────────────
-- A flat per-(delivery, invitee) view exposing everything the roster UI needs:
-- profile snapshot + latest-attempt status + check-in status. Uses
-- `security_invoker = on` so RLS evaluates against the caller's role (not the
-- view owner's), keeping the existing per-table policies in force.
create or replace view public.module_roster_view
with (security_invoker = on) as
select
  p.id              as manager_id,
  p.name,
  p.email,
  p.avatar_color,
  p.cohort,
  p.status          as profile_status,
  p.last_active_at,
  d.module_slug,
  d.id              as delivery_id,
  d.delivery_index,
  d.started_at      as delivery_started_at,
  d.scheduled_date  as delivery_scheduled_date,
  d.session_started_at,
  d.session_ended_at,
  -- Effective cutoff: max of delivery start + any per-manager reset.
  greatest(
    d.started_at,
    coalesce(
      (select max(r.reset_at)
         from public.module_member_resets r
        where r.manager_id  = p.id
          and r.module_slug = d.module_slug),
      '-infinity'::timestamptz
    )
  ) as effective_cutoff,
  -- Latest attempt for this manager in this module since the cutoff.
  (select a.status
     from public.attempts a
    where a.manager_id  = p.id
      and a.module_slug = d.module_slug
      and a.started_at  >= greatest(
        d.started_at,
        coalesce(
          (select max(r.reset_at)
             from public.module_member_resets r
            where r.manager_id  = p.id
              and r.module_slug = d.module_slug),
          '-infinity'::timestamptz
        )
      )
    order by a.started_at desc
    limit 1) as latest_attempt_status,
  (select a.score_pct
     from public.attempts a
    where a.manager_id  = p.id
      and a.module_slug = d.module_slug
      and a.started_at  >= greatest(
        d.started_at,
        coalesce(
          (select max(r.reset_at)
             from public.module_member_resets r
            where r.manager_id  = p.id
              and r.module_slug = d.module_slug),
          '-infinity'::timestamptz
        )
      )
    order by a.started_at desc
    limit 1) as latest_score_pct,
  (select a.pool
     from public.attempts a
    where a.manager_id  = p.id
      and a.module_slug = d.module_slug
      and a.started_at  >= greatest(
        d.started_at,
        coalesce(
          (select max(r.reset_at)
             from public.module_member_resets r
            where r.manager_id  = p.id
              and r.module_slug = d.module_slug),
          '-infinity'::timestamptz
        )
      )
    order by a.started_at desc
    limit 1) as latest_pool,
  -- Check-in status for the current delivery.
  exists (
    select 1 from public.attendance att
     where att.manager_id = p.id
       and att.delivery_id = d.id
  ) as checked_in,
  (select att.checked_in_at
     from public.attendance att
    where att.manager_id  = p.id
      and att.delivery_id = d.id) as checked_in_at
from public.module_invitees mi
  join public.module_deliveries d on d.id = mi.delivery_id and d.ended_at is null
  join public.profiles          p on p.id = mi.manager_id;


-- ============================================================================
-- END OF MIGRATION 0004
-- ============================================================================
