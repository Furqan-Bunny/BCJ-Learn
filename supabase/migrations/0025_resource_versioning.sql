-- Resource versioning is now controlled by the app (editResource server action),
-- not by a DB trigger. The old BEFORE-UPDATE trigger auto-bumped version + sent
-- notifications on every content change, which (a) ignored the `body` column
-- added in 0023 and (b) conflicts with the new explicit "require re-acknowledgement"
-- toggle. Drop the trigger; keep the `resources_set_updated_at` trigger intact.

drop trigger if exists on_resource_update on public.resources;

-- The function is left in place (harmless, unused) in case a future migration
-- wants to reuse it. Uncomment to remove entirely:
-- drop function if exists public.on_resource_updated();
