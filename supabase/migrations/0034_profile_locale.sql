-- Per-user language preference for the employee experience.
-- 'en' (default) or 'es'. Drives the i18n toggle + Spanish quiz serving.

alter table public.profiles
  add column if not exists locale text not null default 'en';
