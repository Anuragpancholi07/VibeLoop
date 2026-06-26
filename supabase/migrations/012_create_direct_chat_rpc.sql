-- Migration 012: Atomic direct chat room creation RPC
-- This function creates a direct chat room between two users atomically.
-- It uses SECURITY DEFINER so it runs with elevated privileges, bypassing RLS.
-- This avoids the RLS SELECT catch-22 where RETURNING requires membership
-- that doesn't exist yet at the time of INSERT.

CREATE OR REPLACE FUNCTION create_direct_chat(target_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_room_id   UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Validate caller is authenticated
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prevent chatting with yourself
  IF v_caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot chat with yourself';
  END IF;

  -- Check if a direct room already exists between the two users
  SELECT crm1.room_id INTO v_room_id
  FROM chat_room_members crm1
  JOIN chat_room_members crm2 ON crm1.room_id = crm2.room_id
  JOIN chat_rooms cr ON cr.id = crm1.room_id
  WHERE crm1.user_id = v_caller_id
    AND crm2.user_id = target_user_id
    AND cr.type = 'direct'
  LIMIT 1;

  -- If no existing room, create one
  IF v_room_id IS NULL THEN
    v_room_id := gen_random_uuid();

    INSERT INTO chat_rooms (id, type, name, is_active, created_at, updated_at)
    VALUES (v_room_id, 'direct', NULL, TRUE, NOW(), NOW());

    INSERT INTO chat_room_members (room_id, user_id)
    VALUES (v_room_id, v_caller_id), (v_room_id, target_user_id);
  END IF;

  RETURN v_room_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_direct_chat(UUID) TO authenticated;

-- Also ensure INSERT policies exist (idempotent - safe to re-run)
DROP POLICY IF EXISTS "Authenticated users can create chat rooms" ON chat_rooms;
CREATE POLICY "Authenticated users can create chat rooms"
  ON chat_rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can add chat room members" ON chat_room_members;
CREATE POLICY "Authenticated users can add chat room members"
  ON chat_room_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
