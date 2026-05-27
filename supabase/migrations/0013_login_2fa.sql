-- ============================================================================
-- BCJ Learn — Migration 0013: opt-in email-OTP two-factor on login
-- ----------------------------------------------------------------------------
-- Adds a per-user two_factor_enabled flag (off by default), a service-role-only
-- email_otps table for one-time login codes, and a branded login_code email
-- template. Login OTP is a custom layer (requestLoginOtp / verifyLoginOtp) —
-- Supabase has no email-OTP-as-second-factor for password sign-in.
-- ============================================================================

alter table public.profiles
  add column if not exists two_factor_enabled boolean not null default false;

-- One-time login codes. RLS on with NO policies = only the service role can
-- read/write (server actions). Never exposed to the browser.
create table if not exists public.email_otps (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code        text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists email_otps_email_idx on public.email_otps (email);
alter table public.email_otps enable row level security;

-- Branded sign-in code email.
insert into public.email_templates (key, subject, body_markdown, variables) values
  ('login_code',
   'Your BCJ Learn sign-in code',
   '# Hi {{name}},

Your BCJ Learn sign-in code is:

## {{code}}

It expires in 10 minutes. If you didn''t try to sign in, you can ignore this email.

— The BCJ team',
   '["name", "code"]'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- END OF MIGRATION 0013
-- ============================================================================
