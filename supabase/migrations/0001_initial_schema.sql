-- ============================================================================
-- BCJ Learn — Initial schema
-- ----------------------------------------------------------------------------
-- Execution order (avoids forward-reference errors):
--   1. extensions
--   2. enums
--   3. set_updated_at() (no table deps)
--   4. ALL tables in dependency order
--   5. helper functions (depend on profiles + module_owners)
--   6. user triggers (handle_new_user, track_last_active)
--   7. RLS enable + policies
--   8. SECURITY DEFINER quiz-flow functions
--   9. storage buckets + policies
-- ============================================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;


-- ============================================================================
-- 1. ENUMS
-- ============================================================================

create type user_role         as enum ('manager', 'teacher', 'admin');
create type cohort            as enum ('Atlanta', 'Dallas', 'Phoenix');
create type manager_status    as enum ('active', 'at-risk', 'inactive', 'completed');
create type module_status     as enum ('draft', 'published', 'archived');
create type attempt_status    as enum ('passed', 'failed', 'in-progress', 'scheduled');
create type question_status   as enum ('pending', 'approved', 'rejected', 'edited');
create type question_pool     as enum ('first-attempt', 'retake');
create type content_type      as enum ('video', 'document', 'slides', 'link');
create type notification_kind as enum ('invitation', 'reminder', 'result', 'alert');
create type invitee_status    as enum ('invited', 'opted-out');
create type ack_content_type  as enum ('sop', 'module_update', 'resource');
create type activity_kind as enum (
  'quiz_passed', 'quiz_failed', 'retake_scheduled', 'module_published',
  'module_assigned', 'user_added', 'user_deactivated', 'reminder_sent',
  'report_exported', 'questions_approved', 'manager_flagged',
  'delivery_rescheduled', 'manager_checked_in', 'session_started', 'session_ended'
);


-- ============================================================================
-- 2. TRIGGER FUNCTION (no table dependencies — used by multiple tables below)
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ============================================================================
-- 3. TABLES (in dependency order)
-- ============================================================================

-- ─── profiles  (extends auth.users) ───────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text        not null,
  email           text        not null unique,
  role            user_role   not null default 'manager',
  cohort          cohort,
  avatar_color    text        not null default '#1F3A5F',
  status          manager_status,
  bio             text,
  title           text,
  joined_at       timestamptz not null default now(),
  last_active_at  timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_role_idx        on public.profiles (role);
create index profiles_cohort_idx      on public.profiles (cohort) where cohort is not null;
create index profiles_status_idx      on public.profiles (status) where status is not null;
create index profiles_last_active_idx on public.profiles (last_active_at desc);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ─── modules ──────────────────────────────────────────────────────────────
create table public.modules (
  slug                  text primary key,
  number                int  not null unique,
  title                 text not null,
  description           text not null,
  scheduled_month       text,
  scheduled_date        date,
  status                module_status not null default 'draft',
  pass_threshold        numeric(3, 2) not null default 0.85 check (pass_threshold > 0 and pass_threshold <= 1),
  question_count        int  not null default 25,
  time_limit_minutes    int,
  questions_approved    int  not null default 0,
  questions_total       int  not null default 0,
  flashcards            jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index modules_status_idx on public.modules (status);
create index modules_number_idx on public.modules (number);

create trigger modules_set_updated_at
  before update on public.modules
  for each row execute function public.set_updated_at();


-- ─── module_owners  (multi-teacher ownership) ─────────────────────────────
create table public.module_owners (
  module_slug  text not null references public.modules (slug) on delete cascade,
  teacher_id   uuid not null references public.profiles (id) on delete cascade,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (module_slug, teacher_id)
);

create index module_owners_teacher_idx on public.module_owners (teacher_id);
create unique index module_owners_one_primary_idx
  on public.module_owners (module_slug)
  where is_primary = true;


-- ─── lessons ──────────────────────────────────────────────────────────────
create table public.lessons (
  id                uuid primary key default gen_random_uuid(),
  module_slug       text not null references public.modules (slug) on delete cascade,
  "order"           int  not null,
  title             text not null,
  description       text not null default '',
  duration_minutes  int  not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (module_slug, "order")
);

create index lessons_module_idx on public.lessons (module_slug);

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();


-- ─── lesson_contents ──────────────────────────────────────────────────────
create table public.lesson_contents (
  id                uuid primary key default gen_random_uuid(),
  lesson_id         uuid not null references public.lessons (id) on delete cascade,
  type              content_type not null,
  title             text not null,
  duration_minutes  int,
  video_url         text,
  storage_path      text,
  external_url      text,
  metadata          jsonb not null default '{}'::jsonb,
  "order"           int  not null default 0,
  created_at        timestamptz not null default now()
);

create index lesson_contents_lesson_idx on public.lesson_contents (lesson_id);


-- ─── questions ────────────────────────────────────────────────────────────
create table public.questions (
  id                uuid primary key default gen_random_uuid(),
  module_slug       text not null references public.modules (slug) on delete cascade,
  pool              question_pool not null,
  status            question_status not null default 'pending',
  text              text not null,
  explanation       text,
  generated_by_ai   boolean not null default false,
  approved_at       timestamptz,
  approved_by       uuid references public.profiles (id) on delete set null,
  hits              int     not null default 0,
  miss_rate         numeric(4, 3) not null default 0,
  created_at        timestamptz not null default now()
);

create index questions_module_pool_idx on public.questions (module_slug, pool, status);


-- ─── question_options ─────────────────────────────────────────────────────
create table public.question_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions (id) on delete cascade,
  text         text not null,
  correct      boolean not null default false,
  "order"      int  not null,
  created_at   timestamptz not null default now(),
  unique (question_id, "order")
);

create index question_options_question_idx on public.question_options (question_id);


-- ─── module_deliveries ────────────────────────────────────────────────────
create table public.module_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  module_slug         text not null references public.modules (slug) on delete cascade,
  delivery_index      int  not null,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  session_started_at  timestamptz,
  session_ended_at    timestamptz,
  scheduled_date      date,
  created_at          timestamptz not null default now(),
  unique (module_slug, delivery_index)
);

create index module_deliveries_module_idx  on public.module_deliveries (module_slug);
create index module_deliveries_current_idx on public.module_deliveries (module_slug) where ended_at is null;


-- ─── attempts ─────────────────────────────────────────────────────────────
create table public.attempts (
  id              uuid primary key default gen_random_uuid(),
  manager_id      uuid not null references public.profiles (id) on delete cascade,
  module_slug     text not null references public.modules (slug) on delete cascade,
  delivery_id     uuid references public.module_deliveries (id) on delete set null,
  pool            question_pool not null,
  status          attempt_status not null default 'in-progress',
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  score_pct       numeric(5, 2) not null default 0,
  correct_count   int not null default 0,
  total_count     int not null default 0,
  duration_sec    int,
  created_at      timestamptz not null default now()
);

create index attempts_manager_idx        on public.attempts (manager_id);
create index attempts_module_idx         on public.attempts (module_slug);
create index attempts_manager_module_idx on public.attempts (manager_id, module_slug);
create index attempts_delivery_idx       on public.attempts (delivery_id);
create index attempts_status_idx         on public.attempts (status);


-- ─── attempt_answers ──────────────────────────────────────────────────────
create table public.attempt_answers (
  attempt_id          uuid not null references public.attempts (id) on delete cascade,
  question_id         uuid not null references public.questions (id) on delete cascade,
  selected_option_id  uuid references public.question_options (id) on delete set null,
  correct             boolean not null default false,
  answered_at         timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create index attempt_answers_question_idx on public.attempt_answers (question_id);


-- ─── attendance ───────────────────────────────────────────────────────────
create table public.attendance (
  id              uuid primary key default gen_random_uuid(),
  manager_id      uuid not null references public.profiles (id) on delete cascade,
  delivery_id     uuid not null references public.module_deliveries (id) on delete cascade,
  checked_in_at   timestamptz not null default now(),
  unique (manager_id, delivery_id)
);

create index attendance_delivery_idx on public.attendance (delivery_id);


-- ─── module_invitees ──────────────────────────────────────────────────────
create table public.module_invitees (
  delivery_id  uuid not null references public.module_deliveries (id) on delete cascade,
  manager_id   uuid not null references public.profiles (id) on delete cascade,
  status       invitee_status not null default 'invited',
  invited_at   timestamptz not null default now(),
  primary key (delivery_id, manager_id)
);

create index module_invitees_manager_idx on public.module_invitees (manager_id);


-- ─── activity ─────────────────────────────────────────────────────────────
create table public.activity (
  id            uuid primary key default gen_random_uuid(),
  kind          activity_kind not null,
  actor_id      uuid references public.profiles (id) on delete set null,
  target_id     uuid,
  message       text not null,
  occurred_at   timestamptz not null default now()
);

create index activity_occurred_idx on public.activity (occurred_at desc);
create index activity_actor_idx    on public.activity (actor_id);
create index activity_kind_idx     on public.activity (kind);


-- ─── notifications ────────────────────────────────────────────────────────
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  kind          notification_kind not null,
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  subject       text not null,
  preview       text not null,
  body          text,
  sent_at       timestamptz not null default now(),
  opened        boolean not null default false,
  opened_at     timestamptz
);

create index notifications_recipient_idx on public.notifications (recipient_id, sent_at desc);


-- ─── resources ────────────────────────────────────────────────────────────
create table public.resources (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  category              text not null default 'General',
  description           text,
  storage_path          text,
  external_url          text,
  version               int not null default 1,
  requires_ack          boolean not null default false,
  assigned_roles        user_role[] not null default array['manager']::user_role[],
  assigned_cohorts      cohort[],
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index resources_category_idx on public.resources (category);

create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();


-- ─── acknowledgements ─────────────────────────────────────────────────────
create table public.acknowledgements (
  id                uuid primary key default gen_random_uuid(),
  content_type      ack_content_type not null,
  content_ref       text not null,
  content_version   int  not null,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  acknowledged_at   timestamptz not null default now(),
  unique (content_type, content_ref, content_version, user_id)
);

create index ack_user_idx        on public.acknowledgements (user_id);
create index ack_content_ref_idx on public.acknowledgements (content_type, content_ref);


-- ============================================================================
-- 4. HELPER FUNCTIONS (now safe to define — referenced tables exist)
-- ============================================================================

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'::user_role;
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'teacher'::user_role;
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'manager'::user_role;
$$;

create or replace function public.owns_module(p_module_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.module_owners
    where module_slug = p_module_slug
      and teacher_id  = auth.uid()
  );
$$;


-- ============================================================================
-- 5. USER TRIGGERS  (auto-profile + last-active tracking)
-- ============================================================================

-- Auto-create a profile when a new auth.user row is inserted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_role  user_role;
begin
  v_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );
  v_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::user_role,
    'manager'::user_role
  );

  insert into public.profiles (id, name, email, role)
  values (new.id, v_name, new.email, v_role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Touch profiles.last_active_at on every sign-in.
create or replace function public.track_last_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles
       set last_active_at = new.last_sign_in_at
     where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_signin
  after update of last_sign_in_at on auth.users
  for each row execute function public.track_last_active();


-- ============================================================================
-- 6. RLS — enable + policies
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.modules           enable row level security;
alter table public.module_owners     enable row level security;
alter table public.lessons           enable row level security;
alter table public.lesson_contents   enable row level security;
alter table public.questions         enable row level security;
alter table public.question_options  enable row level security;
alter table public.module_deliveries enable row level security;
alter table public.attempts          enable row level security;
alter table public.attempt_answers   enable row level security;
alter table public.attendance        enable row level security;
alter table public.module_invitees   enable row level security;
alter table public.activity          enable row level security;
alter table public.notifications     enable row level security;
alter table public.resources         enable row level security;
alter table public.acknowledgements  enable row level security;


-- ─── profiles ─────────────────────────────────────────────
create policy "profiles: admin all"    on public.profiles for all    using (public.is_admin()) with check (public.is_admin());
create policy "profiles: teacher read" on public.profiles for select using (public.is_teacher());
create policy "profiles: self read"    on public.profiles for select using (id = auth.uid());
create policy "profiles: self update"  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ─── modules ──────────────────────────────────────────────
create policy "modules: admin all"          on public.modules for all    using (public.is_admin()) with check (public.is_admin());
create policy "modules: teacher read"       on public.modules for select using (public.is_teacher());
create policy "modules: teacher update own" on public.modules for update using (public.is_teacher() and public.owns_module(slug)) with check (public.is_teacher() and public.owns_module(slug));
create policy "modules: manager read pub"   on public.modules for select using (public.is_manager() and status = 'published');

-- ─── module_owners ────────────────────────────────────────
create policy "module_owners: admin all" on public.module_owners for all    using (public.is_admin()) with check (public.is_admin());
create policy "module_owners: read all"  on public.module_owners for select using (auth.role() = 'authenticated');

-- ─── lessons ──────────────────────────────────────────────
create policy "lessons: admin all"        on public.lessons for all    using (public.is_admin()) with check (public.is_admin());
create policy "lessons: teacher read"     on public.lessons for select using (public.is_teacher());
create policy "lessons: teacher cud own"  on public.lessons for all    using (public.is_teacher() and public.owns_module(module_slug)) with check (public.is_teacher() and public.owns_module(module_slug));
create policy "lessons: manager read pub" on public.lessons for select using (
  public.is_manager()
  and exists (select 1 from public.modules m where m.slug = lessons.module_slug and m.status = 'published')
);

-- ─── lesson_contents ──────────────────────────────────────
create policy "lesson_contents: admin all" on public.lesson_contents for all using (public.is_admin()) with check (public.is_admin());
create policy "lesson_contents: teacher cud own" on public.lesson_contents for all
  using (public.is_teacher() and exists (
    select 1 from public.lessons l where l.id = lesson_contents.lesson_id and public.owns_module(l.module_slug)
  ))
  with check (public.is_teacher() and exists (
    select 1 from public.lessons l where l.id = lesson_contents.lesson_id and public.owns_module(l.module_slug)
  ));
create policy "lesson_contents: read pub" on public.lesson_contents for select
  using (exists (
    select 1 from public.lessons l
      join public.modules m on m.slug = l.module_slug
    where l.id = lesson_contents.lesson_id and m.status = 'published'
  ));

-- ─── questions ────────────────────────────────────────────
-- Managers do NOT read directly. Quiz flow goes through SECURITY DEFINER fn.
create policy "questions: admin all"    on public.questions for all using (public.is_admin()) with check (public.is_admin());
create policy "questions: teacher cud"  on public.questions for all
  using (public.is_teacher() and public.owns_module(module_slug))
  with check (public.is_teacher() and public.owns_module(module_slug));
create policy "questions: teacher read" on public.questions for select using (public.is_teacher());

-- ─── question_options ─────────────────────────────────────
create policy "question_options: admin all"   on public.question_options for all using (public.is_admin()) with check (public.is_admin());
create policy "question_options: teacher cud" on public.question_options for all
  using (public.is_teacher() and exists (
    select 1 from public.questions q where q.id = question_options.question_id and public.owns_module(q.module_slug)
  ))
  with check (public.is_teacher() and exists (
    select 1 from public.questions q where q.id = question_options.question_id and public.owns_module(q.module_slug)
  ));
create policy "question_options: teacher read" on public.question_options for select using (public.is_teacher());

-- ─── module_deliveries ────────────────────────────────────
create policy "deliveries: admin all"      on public.module_deliveries for all using (public.is_admin()) with check (public.is_admin());
create policy "deliveries: read all"       on public.module_deliveries for select using (auth.role() = 'authenticated');
create policy "deliveries: teacher update" on public.module_deliveries for update
  using (public.is_teacher() and public.owns_module(module_slug))
  with check (public.is_teacher() and public.owns_module(module_slug));

-- ─── attempts ─────────────────────────────────────────────
create policy "attempts: admin all"        on public.attempts for all    using (public.is_admin()) with check (public.is_admin());
create policy "attempts: teacher read own" on public.attempts for select using (public.is_teacher() and public.owns_module(module_slug));
create policy "attempts: self read"        on public.attempts for select using (manager_id = auth.uid());
-- INSERT/UPDATE by managers happens only through SECURITY DEFINER functions.

-- ─── attempt_answers ──────────────────────────────────────
create policy "attempt_answers: admin all" on public.attempt_answers for all using (public.is_admin()) with check (public.is_admin());
create policy "attempt_answers: self read" on public.attempt_answers for select using (
  exists (select 1 from public.attempts a where a.id = attempt_answers.attempt_id and a.manager_id = auth.uid())
);
create policy "attempt_answers: teacher read own" on public.attempt_answers for select using (
  public.is_teacher() and exists (
    select 1 from public.attempts a where a.id = attempt_answers.attempt_id and public.owns_module(a.module_slug)
  )
);

-- ─── attendance ───────────────────────────────────────────
create policy "attendance: admin all"     on public.attendance for all using (public.is_admin()) with check (public.is_admin());
create policy "attendance: self all"      on public.attendance for all using (manager_id = auth.uid()) with check (manager_id = auth.uid());
create policy "attendance: teacher read"  on public.attendance for select using (
  public.is_teacher() and exists (
    select 1 from public.module_deliveries d where d.id = attendance.delivery_id and public.owns_module(d.module_slug)
  )
);

-- ─── module_invitees ──────────────────────────────────────
create policy "invitees: admin all"    on public.module_invitees for all using (public.is_admin()) with check (public.is_admin());
create policy "invitees: self read"    on public.module_invitees for select using (manager_id = auth.uid());
create policy "invitees: teacher read" on public.module_invitees for select using (
  public.is_teacher() and exists (
    select 1 from public.module_deliveries d where d.id = module_invitees.delivery_id and public.owns_module(d.module_slug)
  )
);

-- ─── activity ─────────────────────────────────────────────
create policy "activity: admin all"    on public.activity for all using (public.is_admin()) with check (public.is_admin());
create policy "activity: teacher read" on public.activity for select using (public.is_teacher());
create policy "activity: self read"    on public.activity for select using (actor_id = auth.uid() or target_id = auth.uid());
create policy "activity: self insert"  on public.activity for insert with check (actor_id = auth.uid());

-- ─── notifications ────────────────────────────────────────
create policy "notifications: admin all"   on public.notifications for all using (public.is_admin()) with check (public.is_admin());
create policy "notifications: self read"   on public.notifications for select using (recipient_id = auth.uid());
create policy "notifications: self update" on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ─── resources ────────────────────────────────────────────
create policy "resources: admin all"     on public.resources for all using (public.is_admin()) with check (public.is_admin());
create policy "resources: teacher cud"   on public.resources for all using (public.is_teacher()) with check (public.is_teacher());
create policy "resources: assignee read" on public.resources for select using (
  public.current_user_role() = any(assigned_roles)
);

-- ─── acknowledgements ─────────────────────────────────────
create policy "ack: admin all"    on public.acknowledgements for all using (public.is_admin()) with check (public.is_admin());
create policy "ack: teacher read" on public.acknowledgements for select using (public.is_teacher());
create policy "ack: self all"     on public.acknowledgements for all using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================================
-- 7. SECURITY DEFINER functions for quiz flow
-- ============================================================================

-- Begin a quiz attempt. Returns shuffled questions + options, NO `correct` field.
create or replace function public.start_quiz_attempt(
  p_module_slug text,
  p_pool        question_pool
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_id  uuid;
  v_module      public.modules%rowtype;
  v_delivery_id uuid;
  v_payload     json;
begin
  if not public.is_manager() then
    raise exception 'Only managers can start a quiz attempt';
  end if;

  select * into v_module from public.modules where slug = p_module_slug;
  if not found then
    raise exception 'Module % not found', p_module_slug;
  end if;
  if v_module.status <> 'published' then
    raise exception 'Module % is not published', p_module_slug;
  end if;

  select id into v_delivery_id
    from public.module_deliveries
   where module_slug = p_module_slug and ended_at is null
   order by delivery_index desc
   limit 1;

  insert into public.attempts (manager_id, module_slug, delivery_id, pool, status, total_count)
  values (auth.uid(), p_module_slug, v_delivery_id, p_pool, 'in-progress', v_module.question_count)
  returning id into v_attempt_id;

  with picked as (
    select q.id, q.text, q.explanation
      from public.questions q
     where q.module_slug = p_module_slug
       and q.pool        = p_pool
       and q.status      = 'approved'
     order by random()
     limit v_module.question_count
  )
  select json_build_object(
    'attempt_id', v_attempt_id,
    'time_limit_minutes', v_module.time_limit_minutes,
    'questions', (
      select coalesce(json_agg(json_build_object(
        'id', p.id,
        'text', p.text,
        'options', (
          select coalesce(json_agg(json_build_object(
            'id',    o.id,
            'text',  o.text,
            'order', o."order"
          ) order by random()), '[]'::json)
          from public.question_options o
          where o.question_id = p.id
        )
      )), '[]'::json)
      from picked p
    )
  ) into v_payload;

  return v_payload;
end;
$$;


-- Submit + grade a quiz attempt server-side.
create or replace function public.submit_quiz_attempt(
  p_attempt_id uuid,
  p_answers    jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt        public.attempts%rowtype;
  v_module         public.modules%rowtype;
  v_correct_count  int := 0;
  v_total_count    int := 0;
  v_score_pct      numeric(5, 2);
  v_passed         boolean;
  v_answer         jsonb;
  v_correct        boolean;
  v_duration_sec   int;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id;
  if not found then raise exception 'Attempt % not found', p_attempt_id; end if;
  if v_attempt.manager_id <> auth.uid() then raise exception 'Not your attempt'; end if;
  if v_attempt.status <> 'in-progress' then raise exception 'Attempt already submitted'; end if;

  select * into v_module from public.modules where slug = v_attempt.module_slug;

  v_total_count := jsonb_array_length(p_answers);

  for v_answer in select * from jsonb_array_elements(p_answers) loop
    select coalesce(o.correct, false) into v_correct
      from public.question_options o
     where o.id = (v_answer ->> 'selected_option_id')::uuid;

    insert into public.attempt_answers (attempt_id, question_id, selected_option_id, correct)
    values (
      p_attempt_id,
      (v_answer ->> 'question_id')::uuid,
      nullif(v_answer ->> 'selected_option_id', '')::uuid,
      coalesce(v_correct, false)
    )
    on conflict (attempt_id, question_id) do update
      set selected_option_id = excluded.selected_option_id,
          correct            = excluded.correct;

    if coalesce(v_correct, false) then
      v_correct_count := v_correct_count + 1;
    end if;
  end loop;

  v_score_pct := case when v_total_count > 0
                   then round((v_correct_count::numeric / v_total_count) * 100, 2)
                   else 0
                end;
  v_passed       := v_score_pct >= (v_module.pass_threshold * 100);
  v_duration_sec := extract(epoch from (now() - v_attempt.started_at))::int;

  update public.attempts
     set status        = case when v_passed then 'passed'::attempt_status else 'failed'::attempt_status end,
         submitted_at  = now(),
         score_pct     = v_score_pct,
         correct_count = v_correct_count,
         total_count   = v_total_count,
         duration_sec  = v_duration_sec
   where id = p_attempt_id;

  insert into public.activity (kind, actor_id, target_id, message)
  values (
    case when v_passed then 'quiz_passed'::activity_kind else 'quiz_failed'::activity_kind end,
    auth.uid(),
    null,
    case when v_passed
      then format('Passed %s with %s%%', v_module.title, v_score_pct)
      else format('Failed %s — %s%%; retake auto-scheduled', v_module.title, v_score_pct)
    end
  );

  if (not v_passed) and v_attempt.pool = 'first-attempt' then
    insert into public.attempts (manager_id, module_slug, delivery_id, pool, status, total_count)
    values (v_attempt.manager_id, v_attempt.module_slug, v_attempt.delivery_id, 'retake', 'scheduled', v_module.question_count);

    insert into public.activity (kind, actor_id, target_id, message)
    values ('retake_scheduled', auth.uid(), null, format('Retake scheduled for %s', v_module.title));
  end if;

  if (not v_passed) and v_attempt.pool = 'retake' then
    insert into public.activity (kind, actor_id, target_id, message)
    values ('manager_flagged', auth.uid(), v_attempt.manager_id,
            format('Flagged — failed retake on %s', v_module.title));
    update public.profiles set status = 'at-risk' where id = v_attempt.manager_id;
  end if;

  return json_build_object(
    'attempt_id',    p_attempt_id,
    'score_pct',     v_score_pct,
    'correct_count', v_correct_count,
    'total_count',   v_total_count,
    'passed',        v_passed
  );
end;
$$;


-- Schedule a re-delivery of a module.
create or replace function public.schedule_redelivery(
  p_module_slug    text,
  p_new_start_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_delivery_id uuid;
  v_next_index      int;
begin
  if not (public.is_admin() or (public.is_teacher() and public.owns_module(p_module_slug))) then
    raise exception 'Not authorised to schedule re-delivery';
  end if;

  update public.module_deliveries
     set ended_at = now()
   where module_slug = p_module_slug
     and ended_at is null;

  select coalesce(max(delivery_index), 0) + 1 into v_next_index
    from public.module_deliveries
   where module_slug = p_module_slug;

  insert into public.module_deliveries (module_slug, delivery_index, scheduled_date)
  values (p_module_slug, v_next_index, p_new_start_date)
  returning id into v_new_delivery_id;

  insert into public.module_invitees (delivery_id, manager_id, status)
  select v_new_delivery_id, p.id, 'invited'
    from public.profiles p
   where p.role = 'manager'
     and not exists (
       select 1 from public.attempts a
        where a.manager_id  = p.id
          and a.module_slug = p_module_slug
          and a.status      = 'passed'
     );

  insert into public.activity (kind, actor_id, target_id, message)
  values ('delivery_rescheduled', auth.uid(), null,
          format('Re-delivery #%s scheduled for module %s', v_next_index, p_module_slug));

  return v_new_delivery_id;
end;
$$;


-- ============================================================================
-- 8. STORAGE BUCKETS + POLICIES
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('module-content', 'module-content', false),
  ('branding',       'branding',       true),
  ('avatars',        'avatars',        true)
on conflict (id) do nothing;


-- ─── module-content (private) ─────────────────────────────
create policy "module-content: auth read"
  on storage.objects for select
  using (bucket_id = 'module-content' and auth.role() = 'authenticated');

create policy "module-content: admin/teacher write"
  on storage.objects for insert
  with check (bucket_id = 'module-content' and (public.is_admin() or public.is_teacher()));

create policy "module-content: admin/teacher update"
  on storage.objects for update
  using (bucket_id = 'module-content' and (public.is_admin() or public.is_teacher()))
  with check (bucket_id = 'module-content' and (public.is_admin() or public.is_teacher()));

create policy "module-content: admin/teacher delete"
  on storage.objects for delete
  using (bucket_id = 'module-content' and (public.is_admin() or public.is_teacher()));


-- ─── branding (public read) ───────────────────────────────
create policy "branding: public read"
  on storage.objects for select
  using (bucket_id = 'branding');

create policy "branding: admin write"
  on storage.objects for insert
  with check (bucket_id = 'branding' and public.is_admin());

create policy "branding: admin update"
  on storage.objects for update
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());

create policy "branding: admin delete"
  on storage.objects for delete
  using (bucket_id = 'branding' and public.is_admin());


-- ─── avatars (public read; self write) ────────────────────
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: self write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: self update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: self delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- END OF MIGRATION 0001
-- ============================================================================
