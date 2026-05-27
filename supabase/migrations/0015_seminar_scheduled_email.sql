-- ============================================================================
-- BCJ Learn — Migration 0015: "seminar scheduled" notification email template
-- ----------------------------------------------------------------------------
-- Sent (via Resend) to each employee invited when an admin/teacher schedules a
-- seminar for a module, telling them the date.
-- ============================================================================

insert into public.email_templates (key, subject, body_markdown, variables) values
  ('seminar_scheduled',
   'You''re scheduled: {{module_title}}',
   '# Hi {{name}},

You''re scheduled to attend **{{module_title}}** on **{{seminar_date}}**.

Please attend the seminar and complete the quiz on the day.

[Open BCJ Learn]({{link}})

— The BCJ team',
   '["name","module_title","seminar_date","link"]'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- END OF MIGRATION 0015
-- ============================================================================
