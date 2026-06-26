-- Migration 013: Fix self-referencing RLS policy on chat_room_members
-- 
-- PROBLEM: The chat_room_members SELECT policy references chat_room_members itself,
-- causing infinite recursion. When PostgreSQL evaluates whether a user can SELECT
-- from chat_room_members, it runs the policy which queries chat_room_members again,
-- which triggers the policy again, infinitely. This silently breaks:
--   - chat_rooms SELECT (subquery on chat_room_members fails)
--   - chat_messages SELECT (subquery on chat_room_members fails)
--   - chat_messages INSERT (subquery on chat_room_members fails)
--
-- FIX: Create a SECURITY DEFINER helper function that checks membership without
-- triggering RLS, then use it in all chat-related policies.

-- Step 1: Create a SECURITY DEFINER helper function that bypasses RLS
-- to check if the current user is a member of a given room.
CREATE OR REPLACE FUNCTION user_is_room_member(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_room_members
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION user_is_room_member(UUID) TO authenticated;

-- Step 2: Fix the self-referencing chat_room_members SELECT policy
DROP POLICY IF EXISTS "Room members viewable by room members" ON chat_room_members;
CREATE POLICY "Room members viewable by room members" ON chat_room_members
  FOR SELECT USING (user_is_room_member(room_id));

-- Step 3: Fix chat_rooms SELECT to also use the helper function (cleaner + consistent)
DROP POLICY IF EXISTS "Chat rooms viewable by members" ON chat_rooms;
CREATE POLICY "Chat rooms viewable by members" ON chat_rooms
  FOR SELECT USING (user_is_room_member(id));

-- Step 4: Fix chat_messages SELECT to use the helper function
DROP POLICY IF EXISTS "Messages viewable by room members" ON chat_messages;
CREATE POLICY "Messages viewable by room members" ON chat_messages
  FOR SELECT USING (user_is_room_member(room_id));

-- Step 5: Fix chat_messages INSERT to use the helper function
DROP POLICY IF EXISTS "Members can send messages" ON chat_messages;
CREATE POLICY "Members can send messages" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND user_is_room_member(room_id)
  );

-- Step 6: Ensure the INSERT policies from migration 011 are also in place
-- (idempotent - safe to re-run even if already applied)
DROP POLICY IF EXISTS "Authenticated users can create chat rooms" ON chat_rooms;
CREATE POLICY "Authenticated users can create chat rooms"
  ON chat_rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can add chat room members" ON chat_room_members;
CREATE POLICY "Authenticated users can add chat room members"
  ON chat_room_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can update chat rooms" ON chat_rooms;
CREATE POLICY "Members can update chat rooms"
  ON chat_rooms FOR UPDATE
  USING (user_is_room_member(id));
