-- Markets renamed from states back to the hub cities BCJ uses internally.
--   Georgia        -> Atlanta
--   Tennessee      -> Nashville
--   North Carolina -> Charlotte
--
-- Renames the `cohort` enum values in place (Postgres rewrites every row that
-- uses the enum automatically — incl. resources.assigned_cohorts) and rewrites
-- the free-text profiles.markets[] copies to match. RENAME VALUE is
-- transaction-safe (unlike ADD VALUE).

alter type cohort rename value 'Georgia'        to 'Atlanta';
alter type cohort rename value 'Tennessee'      to 'Nashville';
alter type cohort rename value 'North Carolina' to 'Charlotte';

update public.profiles set markets = array_replace(markets, 'Georgia',        'Atlanta');
update public.profiles set markets = array_replace(markets, 'Tennessee',      'Nashville');
update public.profiles set markets = array_replace(markets, 'North Carolina', 'Charlotte');
