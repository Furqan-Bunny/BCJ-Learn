-- ============================================================================
-- BCJ Learn — Migration 0003: user flow & account management
-- ----------------------------------------------------------------------------
-- Adds:
--   • profiles.onboarded_at, timezone, locale     (self-service prep)
--   • email_templates table                        (editable invitation/reminder/result emails)
--   • activity_kind enum value 'password_reset_requested'
--   • resources.notify_on_update column            (controls re-ack notification firing)
--   • on_resource_updated trigger                  (bumps version + queues notifications)
-- ============================================================================


-- ─── profiles additions ───────────────────────────────────
alter table public.profiles
  add column if not exists onboarded_at timestamptz,
  add column if not exists timezone     text default 'America/New_York',
  add column if not exists locale       text default 'en';


-- ─── activity_kind — new value for admin-triggered password resets ─
alter type activity_kind add value if not exists 'password_reset_requested';


-- ─── email_templates table ────────────────────────────────
-- Admin-editable email content. Send pipeline (Resend) renders these with
-- variable substitution at send time. Variables list is stored as JSONB so
-- the editor UI can show available placeholders.

create table if not exists public.email_templates (
  key            text primary key,
  subject        text not null,
  body_markdown  text not null,
  variables      jsonb not null default '[]'::jsonb,
  updated_by     uuid references public.profiles (id) on delete set null,
  updated_at     timestamptz not null default now()
);

alter table public.email_templates enable row level security;

create policy "email_templates: admin all" on public.email_templates
  for all using (public.is_admin()) with check (public.is_admin());

create policy "email_templates: authenticated read" on public.email_templates
  for select using (auth.role() = 'authenticated');

create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- Seed default templates. Body uses {{variable}} placeholders.
insert into public.email_templates (key, subject, body_markdown, variables) values
  ('invite',
   'Welcome to BCJ Learn',
   '# Hi {{name}},

You''ve been invited to join BCJ Learn — our internal training and quiz platform.

[Set up your account]({{invite_link}})

This link expires in 7 days.

— The BCJ team',
   '["name", "invite_link"]'::jsonb),

  ('password_reset',
   'Reset your BCJ Learn password',
   '# Hi {{name}},

You requested a password reset. Click the link below to set a new password:

[Reset password]({{reset_link}})

If you didn''t request this, ignore this email. The link expires in 1 hour.',
   '["name", "reset_link"]'::jsonb),

  ('welcome',
   'You''re all set on BCJ Learn',
   '# Welcome, {{name}}!

Your account is ready. Your first training module is scheduled for {{first_module_date}}.

[Open BCJ Learn]({{app_url}})',
   '["name", "first_module_date", "app_url"]'::jsonb),

  ('quiz_passed',
   'You passed {{module_title}} 🎉',
   '# Great work, {{name}}!

You scored **{{score}}%** on the {{module_title}} quiz — well above the 85% pass threshold.

The next module unlocks on {{next_module_date}}.

[View your progress]({{progress_link}})',
   '["name", "module_title", "score", "next_module_date", "progress_link"]'::jsonb),

  ('quiz_failed',
   'Retake scheduled for {{module_title}}',
   '# Hi {{name}},

You scored **{{score}}%** on the {{module_title}} quiz. Don''t worry — a retake is automatically scheduled using an easier question set.

You can take it any time.

[Take the retake]({{retake_link}})',
   '["name", "module_title", "score", "retake_link"]'::jsonb),

  ('overdue_reminder',
   'Reminder: {{module_title}} quiz is overdue',
   '# Hi {{name}},

You haven''t completed the **{{module_title}}** quiz yet. Please complete it by {{due_date}}.

[Take the quiz]({{quiz_link}})',
   '["name", "module_title", "due_date", "quiz_link"]'::jsonb),

  ('at_risk_alert',
   'BCJ Learn — {{employee_name}} flagged at-risk',
   '# Hi {{admin_name}},

{{employee_name}} ({{cohort}}) has been flagged as at-risk. Reason: {{reason}}.

[Review their profile]({{profile_link}})',
   '["admin_name", "employee_name", "cohort", "reason", "profile_link"]'::jsonb)

on conflict (key) do nothing;


-- ─── resources: notify_on_update toggle ───────────────────
-- Lets admins choose whether updating a resource fires a re-ack notification
-- to assigned users. Defaults to true (the common case).
alter table public.resources
  add column if not exists notify_on_update boolean not null default true;


-- ─── Trigger: on resource update, bump version + notify ────
-- Fires when an admin/teacher saves an edit to a resource. If content changed
-- AND notify_on_update is true, increments version and inserts a notification
-- row for every assigned user.

create or replace function public.on_resource_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  content_changed boolean;
  v_user_id uuid;
begin
  content_changed := (
    old.storage_path is distinct from new.storage_path
    or old.external_url is distinct from new.external_url
    or old.title       is distinct from new.title
    or old.description is distinct from new.description
  );

  if content_changed and new.notify_on_update then
    -- Bump version so re-ack is required
    new.version := old.version + 1;

    -- Notify every assigned user (after the UPDATE commits)
    for v_user_id in
      select p.id
        from public.profiles p
       where p.role = any(new.assigned_roles)
         and (new.assigned_cohorts is null or p.cohort = any(new.assigned_cohorts))
    loop
      insert into public.notifications (kind, recipient_id, subject, preview)
      values (
        'alert',
        v_user_id,
        format('Resource updated: %s', new.title),
        format('A new version of "%s" is available — please review and acknowledge.', new.title)
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists on_resource_update on public.resources;
create trigger on_resource_update
  before update on public.resources
  for each row execute function public.on_resource_updated();


-- ============================================================================
-- END OF MIGRATION 0003
-- ============================================================================
