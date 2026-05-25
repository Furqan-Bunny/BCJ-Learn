-- 0011_activity_user_deleted.sql
-- Adds a dedicated activity_kind value for permanent user deletion so the audit
-- log distinguishes a hard delete from a (reversible) deactivation.
--
-- Like 0003 (password_reset_requested), this adds an enum value on its own.
-- A new enum value can't be used in the same transaction it's created, but
-- logActivity('user_deleted', …) runs at runtime, well after this commits.

alter type activity_kind add value if not exists 'user_deleted';
