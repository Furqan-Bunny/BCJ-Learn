-- Audit logins. Adds a new `activity_kind` value so a sign-in can be recorded
-- in the activity feed (Nancy wants to see who has logged in).
--
-- NOTE: ADD VALUE is not allowed inside a txn block alongside use of the new
-- value, so this migration only adds the value. It is consumed at runtime by
-- logSignIn() in auth-actions.ts, never in this migration.

alter type activity_kind add value if not exists 'user_login';
