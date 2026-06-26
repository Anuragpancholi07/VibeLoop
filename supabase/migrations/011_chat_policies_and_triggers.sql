-- Migration 011: Chat RLS policies and automation triggers

-- 1. Create triggers to update chat room last message info
CREATE OR REPLACE FUNCTION update_chat_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_rooms
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = CASE 
      WHEN NEW.message_type = 'text' THEN NEW.content
      WHEN NEW.message_type = 'image' THEN '🖼️ Photo'
      WHEN NEW.message_type = 'file' THEN '📁 File'
      ELSE 'New message'
    END,
    updated_at = NOW()
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_chat_messages_after_insert ON chat_messages;
CREATE TRIGGER tr_chat_messages_after_insert
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_room_last_message();


-- 2. Create trigger to update members count automatically
CREATE OR REPLACE FUNCTION update_chat_room_members_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE chat_rooms
    SET members_count = members_count + 1
    WHERE id = NEW.room_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE chat_rooms
    SET members_count = GREATEST(0, members_count - 1)
    WHERE id = OLD.room_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_chat_room_members_change ON chat_room_members;
CREATE TRIGGER tr_chat_room_members_change
  AFTER INSERT OR DELETE ON chat_room_members
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_room_members_count();


-- 3. RLS Policies for chat_rooms
DROP POLICY IF EXISTS "Authenticated users can create chat rooms" ON chat_rooms;
CREATE POLICY "Authenticated users can create chat rooms" 
  ON chat_rooms FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can update chat rooms" ON chat_rooms;
CREATE POLICY "Members can update chat rooms" 
  ON chat_rooms FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = id AND user_id = auth.uid()));


-- 4. RLS Policies for chat_room_members
DROP POLICY IF EXISTS "Authenticated users can add chat room members" ON chat_room_members;
CREATE POLICY "Authenticated users can add chat room members" 
  ON chat_room_members FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can leave or remove from chat rooms" ON chat_room_members;
CREATE POLICY "Members can leave or remove from chat rooms" 
  ON chat_room_members FOR DELETE 
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = chat_room_members.room_id AND user_id = auth.uid()));
