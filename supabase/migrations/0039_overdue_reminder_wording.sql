-- ============================================================================
-- 0039 — Reword the "overdue_reminder" email so it's accurate for retakes
-- ----------------------------------------------------------------------------
-- The original copy (migration 0003) said "you haven't completed the quiz yet"
-- / "quiz is overdue", which wrongly implies the employee never took it. The
-- same reminder is sent both to people who never attempted AND to people who
-- took it once and only need a retake (admin at-risk "notify", plus the daily
-- cron). Neutral wording that is correct in both cases. Same {{variables}} as
-- before (name, module_title, due_date, quiz_link), so all senders keep working.
-- ============================================================================

update public.email_templates
   set subject = 'Reminder: complete your {{module_title}} quiz',
       body_markdown = '# Hi {{name}},

Our records show your **{{module_title}}** quiz isn''t passed yet. Please complete it by {{due_date}}.

[Open the quiz]({{quiz_link}})'
 where key = 'overdue_reminder';
