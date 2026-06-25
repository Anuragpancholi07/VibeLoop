-- Create helper function for Edge Function to call
CREATE OR REPLACE FUNCTION increment_attendees(p_event_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Do nothing because the database trigger 'trigger_update_attendee_count'
  -- automatically increments the event's current_attendees field.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
