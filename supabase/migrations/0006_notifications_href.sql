-- ============================================================================
-- BCJ Learn — Notifications: deep-link column + faster unread lookup + realtime
-- ============================================================================
--
-- Adds a nullable `href` so each notification can deep-link to a relevant page
-- when clicked from the bell. Existing rows stay non-clickable (null href).
--
-- Also enables Supabase Realtime on the notifications table so the bell can
-- subscribe to inserts and update without a refresh. RLS still scopes payloads.

alter table public.notifications
  add column if not exists href text;

-- Partial index for the unread-count query that runs on every bell mount.
-- Only indexes rows that matter for the badge.
create index if not exists notifications_unread_by_recipient_idx
  on public.notifications (recipient_id)
  where opened = false;

-- Realtime: publish the table so the JS client can subscribe.
-- Wrapped in DO so reruns don't error if the table is already published.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ============================================================================
-- END OF MIGRATION 0006
-- ============================================================================
