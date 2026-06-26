-- Migration 010: Database triggers for updating profile event stats

-- 1. Function to update profile events_hosted count
CREATE OR REPLACE FUNCTION update_profile_events_hosted()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET events_hosted = events_hosted + 1 WHERE id = NEW.host_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET events_hosted = events_hosted - 1 WHERE id = OLD.host_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_profile_events_hosted ON events;
CREATE TRIGGER trigger_update_profile_events_hosted
  AFTER INSERT OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION update_profile_events_hosted();


-- 2. Function to update profile events_attended count
CREATE OR REPLACE FUNCTION update_profile_events_attended()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    UPDATE profiles SET events_attended = events_attended + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
      UPDATE profiles SET events_attended = events_attended + 1 WHERE id = NEW.user_id;
    ELSIF OLD.status = 'approved' AND NEW.status != 'approved' THEN
      UPDATE profiles SET events_attended = events_attended - 1 WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE profiles SET events_attended = events_attended - 1 WHERE id = OLD.user_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_profile_events_attended ON event_attendees;
CREATE TRIGGER trigger_update_profile_events_attended
  AFTER INSERT OR UPDATE OR DELETE ON event_attendees
  FOR EACH ROW EXECUTE FUNCTION update_profile_events_attended();


-- 3. Backfill existing stats to ensure everything matches exactly
UPDATE profiles p
SET
  events_hosted = (
    SELECT COUNT(*) FROM events e WHERE e.host_id = p.id
  ),
  events_attended = (
    SELECT COUNT(*) FROM event_attendees ea WHERE ea.user_id = p.id AND ea.status = 'approved'
  ),
  followers_count = (
    SELECT COUNT(*) FROM follows f WHERE f.following_id = p.id
  ),
  following_count = (
    SELECT COUNT(*) FROM follows f WHERE f.follower_id = p.id
  );
