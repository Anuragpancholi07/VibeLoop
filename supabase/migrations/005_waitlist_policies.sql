-- Migration 005: Update RLS policies for event_waitlists table
-- Allow hosts to select, update, and delete waitlist entries for their events.
-- Allow waitlisted users to delete (leave) their own entries.

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Users can view own waitlist" ON event_waitlists;

-- 2. Create updated SELECT policy
CREATE POLICY "Users and hosts can view waitlist" ON event_waitlists
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_waitlists.event_id
      AND e.host_id = auth.uid()
    )
  );

-- 3. Create DELETE policy
CREATE POLICY "Users and hosts can delete waitlist" ON event_waitlists
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_waitlists.event_id
      AND e.host_id = auth.uid()
    )
  );

-- 4. Create UPDATE policy (needed for re-indexing positions)
CREATE POLICY "Hosts can update waitlist" ON event_waitlists
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_waitlists.event_id
      AND e.host_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_waitlists.event_id
      AND e.host_id = auth.uid()
    )
  );
