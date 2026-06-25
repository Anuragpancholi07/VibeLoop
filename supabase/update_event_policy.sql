-- 1. Drop the existing role-restricted policy
DROP POLICY IF EXISTS "Hosts can create events" ON events;

-- 2. Create a new policy allowing any authenticated user to create events where they are the host
CREATE POLICY "Hosts can create events" ON events FOR INSERT WITH CHECK (
  auth.uid() = host_id
);
