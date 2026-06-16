-- ============================================================================
-- BCJ Learn — Migration 0049: certificate link in the "quiz passed" email
-- ----------------------------------------------------------------------------
-- When an employee passes, they earn a certificate of completion. Add a
-- download link to the quiz_passed email (sendQuizResultEmail now passes
-- {{certificate_link}}) and register the new variable. Also drops the hardcoded
-- "85% pass threshold" wording (pass mark is per-module).
-- ============================================================================

update public.email_templates
   set subject = 'You passed {{module_title}} 🎉 — your certificate is ready',
       body_markdown =
'# Great work, {{name}}!

You scored **{{score}}%** on the {{module_title}} quiz — congratulations on passing.

Your **certificate of completion** is ready to download.

[Download your certificate]({{certificate_link}})

You can also find all your certificates any time under **My Progress** in BCJ Learn.

[View your progress]({{progress_link}})',
       variables = '["name", "module_title", "score", "next_module_date", "progress_link", "certificate_link"]'::jsonb
 where key = 'quiz_passed';

-- ============================================================================
-- END OF MIGRATION 0049
-- ============================================================================
