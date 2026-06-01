-- Optional rich-text body for SOPs so admins can write the actual procedure
-- right in the form instead of always having to upload a separate file.
-- Stored as plain text (Markdown). Renders alongside any uploaded file
-- (storage_path) and any external_url — admin can use one or any combination.

alter table public.resources
  add column if not exists body text;
