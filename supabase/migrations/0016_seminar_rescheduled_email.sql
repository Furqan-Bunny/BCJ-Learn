-- ============================================================================
-- BCJ Learn — Migration 0016: "seminar rescheduled" notification email template
-- ----------------------------------------------------------------------------
-- Sent (via Resend) to the already-invited attendees when an admin/teacher moves
-- an existing seminar to a new date (same delivery, same attendees).
-- ============================================================================

insert into public.email_templates (key, subject, body_markdown, variables) values
  ('seminar_rescheduled',
   'Rescheduled: {{module_title}}',
   '# Hi {{name}},

The **{{module_title}}** seminar has been **moved to {{seminar_date}}**.

Please attend on the new date and complete the quiz then.

[Open BCJ Learn]({{link}})

— The BCJ team',
   '["name","module_title","seminar_date","link"]'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- END OF MIGRATION 0016
-- ============================================================================
