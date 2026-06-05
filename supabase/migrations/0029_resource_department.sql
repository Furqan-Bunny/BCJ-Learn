-- Resources can be organised into department "folders" (Nancy's request).
-- Adds a free-text department column; existing rows default to "General".

alter table public.resources
  add column if not exists department text not null default 'General';
