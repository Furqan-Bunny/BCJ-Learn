-- Cohort → Markets (multi-assignment).
--
-- Until now every employee belonged to exactly one `cohort` ("Atlanta",
-- "Dallas", or "Phoenix"). BCJ wants the term renamed to "Market" and wants
-- people to be assignable to multiple markets at once.
--
-- Approach: add a new `markets text[]` column on profiles, back-fill each
-- profile's markets from its current cohort, and let the rest of the codebase
-- migrate to reading the array. The legacy `cohort` column stays in place for
-- now so older read paths keep working; a follow-up migration will drop it
-- once every read/write is on the array.

alter table public.profiles
  add column if not exists markets text[] not null default '{}';

-- Back-fill: each existing profile gets a single-element array from its cohort.
update public.profiles
   set markets = array[cohort::text]
 where cohort is not null
   and (markets is null or array_length(markets, 1) is null);

-- Speed up market-based filtering (e.g. "managers in any of these markets").
create index if not exists profiles_markets_gin
  on public.profiles using gin (markets);
