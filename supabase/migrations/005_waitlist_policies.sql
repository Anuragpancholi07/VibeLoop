-- Migration 005: Update RLS policies for event_waitlists table and allow hosts to manage registrations and tickets
-- Allow hosts to select, update, and delete waitlist entries for their events.
-- Allow waitlisted users to delete (leave) their own entries.
-- Allow hosts to insert attendee records and issue tickets for their events.

-- 1. Drop existing policies on event_waitlists
DROP POLICY IF EXISTS "Users can view own waitlist" ON event_waitlists;
DROP POLICY IF EXISTS "Users and hosts can view waitlist" ON event_waitlists;
DROP POLICY IF EXISTS "Users and hosts can delete waitlist" ON event_waitlists;
DROP POLICY IF EXISTS "Hosts can update waitlist" ON event_waitlists;

-- 2. Create updated SELECT policy for event_waitlists
CREATE POLICY "Users and hosts can view waitlist" ON event_waitlists
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_waitlists.event_id
      AND e.host_id = auth.uid()
    )
  );

-- 3. Create DELETE policy for event_waitlists
CREATE POLICY "Users and hosts can delete waitlist" ON event_waitlists
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_waitlists.event_id
      AND e.host_id = auth.uid()
    )
  );

-- 4. Create UPDATE policy for event_waitlists (needed for re-indexing positions)
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

-- 5. Create INSERT policy on event_attendees to allow hosts to promote/add attendees to their events
DROP POLICY IF EXISTS "Hosts can insert attendees" ON event_attendees;
CREATE POLICY "Hosts can insert attendees" ON event_attendees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_attendees.event_id
      AND e.host_id = auth.uid()
    )
  );

-- 6. Create INSERT policy on event_tickets to allow hosts to issue tickets (e.g. for free events)
DROP POLICY IF EXISTS "Hosts can create tickets for attendees" ON event_tickets;
CREATE POLICY "Hosts can create tickets for attendees" ON event_tickets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_tickets.event_id
      AND e.host_id = auth.uid()
    )
  );
