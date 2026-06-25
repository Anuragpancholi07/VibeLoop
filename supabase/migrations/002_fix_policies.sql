-- ============================================================
-- Migration 002: Fix RLS policies for events
-- Allow any authenticated user (not just hosts) to create events
-- ============================================================

-- Drop the restrictive policy that only allows hosts/admins to create events
DROP POLICY IF EXISTS "Hosts can create events" ON events;

-- Create new policy: any authenticated user can create events
CREATE POLICY "Authenticated users can create events" ON events
  FOR INSERT WITH CHECK (auth.uid() = host_id AND auth.uid() IS NOT NULL);

-- Also add a policy so attendees can see events they are attending (even non-published)
DROP POLICY IF EXISTS "Published events are viewable by everyone" ON events;
CREATE POLICY "Events viewable by everyone when published" ON events FOR SELECT USING (
  status = 'published'
  OR host_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR EXISTS (SELECT 1 FROM event_attendees WHERE event_id = events.id AND user_id = auth.uid())
);

-- Allow users to insert tickets for themselves (for free events)
DROP POLICY IF EXISTS "System can create tickets" ON event_tickets;
CREATE POLICY "Users can create own tickets" ON event_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow payments insert for any authenticated user
DROP POLICY IF EXISTS "Users can create payments" ON payments;
CREATE POLICY "Users can create payments" ON payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow update of payments by user
CREATE POLICY IF NOT EXISTS "Users can update own payments" ON payments
  FOR UPDATE USING (user_id = auth.uid());
