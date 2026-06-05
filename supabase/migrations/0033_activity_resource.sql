-- Log resource create/edit/delete in the global activity feed.
-- ADD VALUE only — consumed at runtime by resource-actions.ts, never here.

alter type activity_kind add value if not exists 'resource_updated';
