-- Seminar start time + trainer-gated, code-protected check-in.
--
-- Adds a start TIME to the seminar (previously date-only), and the state a
-- delivery needs for the 3-phase presenter flow:
--   1. Lobby/check-in  → trainer opens check-in (checkin_opened_at) which mints
--      a short code (checkin_code); employees must enter that code to check in,
--      and only once the scheduled time has arrived.
--   2. Presentation    → trainer starts the session (session_started_at).
--   3. Wrap-up         → trainer ends the session (session_ended_at); quiz opens.

-- Start time (HH:MM, 24h) — nullable so existing rows keep working.
alter table public.modules           add column if not exists scheduled_time text;
alter table public.module_deliveries add column if not exists scheduled_time text;

-- Check-in gate state on each delivery.
alter table public.module_deliveries add column if not exists checkin_opened_at timestamptz;
alter table public.module_deliveries add column if not exists checkin_code text;
