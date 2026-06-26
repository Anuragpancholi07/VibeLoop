-- Migration 014: Chat Unread Counts and Smart Notifications
-- 
-- 1. Create a policy to allow users to update their own last_read_at timestamp
DROP POLICY IF EXISTS "Members can update their own room membership" ON chat_room_members;
CREATE POLICY "Members can update their own room membership" ON chat_room_members
  FOR UPDATE USING (user_id = auth.uid());

-- 2. Create helper RPC function to fetch unread message counts per room for a user
CREATE OR REPLACE FUNCTION get_unread_message_counts(p_user_id UUID)
RETURNS TABLE (
  room_id UUID,
  unread_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id AS room_id,
    COUNT(m.id) AS unread_count
  FROM chat_rooms r
  JOIN chat_room_members my_member ON my_member.room_id = r.id AND my_member.user_id = p_user_id
  LEFT JOIN chat_messages m ON m.room_id = r.id 
    AND m.sender_id != p_user_id 
    AND m.created_at > my_member.last_read_at
  GROUP BY r.id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_unread_message_counts(UUID) TO authenticated;

-- 3. Trigger to send notifications on new message if all previous messages from that user are read (or first time)
CREATE OR REPLACE FUNCTION notify_on_new_chat_message()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
  member_record RECORD;
  unread_count INT;
BEGIN
  -- Fetch sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Notify each other member of the room
  FOR member_record IN
    SELECT user_id, last_read_at
    FROM chat_room_members
    WHERE room_id = NEW.room_id AND user_id != NEW.sender_id
  LOOP
    -- Count prior unread messages from this sender to this member in this room
    SELECT COUNT(*) INTO unread_count
    FROM chat_messages
    WHERE room_id = NEW.room_id
      AND sender_id = NEW.sender_id
      AND id != NEW.id
      AND created_at > member_record.last_read_at;

    -- Send notification only if there are no prior unread messages from this sender
    IF unread_count = 0 THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        member_record.user_id,
        'new_message',
        'New Message from ' || sender_name,
        COALESCE(NEW.content, 'Sent an attachment'),
        jsonb_build_object('room_id', NEW.room_id, 'sender_id', NEW.sender_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_on_new_chat_message ON chat_messages;
CREATE TRIGGER trigger_notify_on_new_chat_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_chat_message();
