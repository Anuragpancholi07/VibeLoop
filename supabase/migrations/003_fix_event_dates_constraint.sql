-- ============================================================
-- Migration 003: Relax check_event_dates constraint
-- Change from strict > to >= to allow same start/end time
-- Also fix any other overly strict constraints
-- ============================================================

-- Drop the strict check constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS check_event_dates;

-- Re-add with >= (allows same start and end time)
-- Clients validate this on the frontend; DB is a safety net only
ALTER TABLE events ADD CONSTRAINT check_event_dates CHECK (end_time >= start_time);
