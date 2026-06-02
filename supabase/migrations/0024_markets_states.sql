-- Markets renamed from cities to states.
--   Atlanta -> Georgia
--   Dallas  -> Tennessee
--   Phoenix -> North Carolina
--
-- Renames the `cohort` enum values in place (Postgres updates every row that
-- uses them automatically) and rewrites the free-text profiles.markets[] copies
-- to match. RENAME VALUE (unlike ADD VALUE) is transaction-safe.

alter type cohort rename value 'Atlanta' to 'Georgia';
alter type cohort rename value 'Dallas'  to 'Tennessee';
alter type cohort rename value 'Phoenix' to 'North Carolina';

update public.profiles set markets = array_replace(markets, 'Atlanta', 'Georgia');
update public.profiles set markets = array_replace(markets, 'Dallas',  'Tennessee');
update public.profiles set markets = array_replace(markets, 'Phoenix', 'North Carolina');
