-- Migration 007: Automatic Database Triggers for Real-Time Notification generation

-- 1. Function and Trigger for event attendee approvals and rejections
CREATE OR REPLACE FUNCTION notify_attendee_status_change()
RETURNS TRIGGER AS $$
DECLARE
  event_title TEXT;
BEGIN
  -- Fetch event title
  SELECT title INTO event_title FROM events WHERE id = NEW.event_id;

  -- Notify user if they are approved by someone other than themselves (the host)
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved' AND NEW.user_id != auth.uid()) OR
     (TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' AND NEW.user_id != auth.uid()) THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'join_approval',
      'Join Request Approved! 🎉',
      'Your request to join "' || event_title || '" has been approved by the host.',
      json_build_object('event_id', NEW.event_id, 'attendee_id', NEW.id)
    );
  -- Notify user if they are rejected by someone other than themselves (the host)
  ELSIF (TG_OP = 'UPDATE' AND OLD.status != 'rejected' AND NEW.status = 'rejected' AND NEW.user_id != auth.uid()) THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'event_cancellation',
      'Join Request Rejected',
      'Your request to join "' || event_title || '" was not approved by the host.',
      json_build_object('event_id', NEW.event_id, 'attendee_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_attendee_status_change ON event_attendees;
CREATE TRIGGER trigger_notify_attendee_status_change
  AFTER INSERT OR UPDATE ON event_attendees
  FOR EACH ROW EXECUTE FUNCTION notify_attendee_status_change();


-- 2. Function and Trigger for new events published in a user's city
CREATE OR REPLACE FUNCTION notify_new_event_in_city()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
BEGIN
  IF NEW.status = 'published' AND NEW.city IS NOT NULL THEN
    -- Find users in the same city (case-insensitive)
    FOR user_record IN 
      SELECT id FROM profiles 
      WHERE LOWER(city) = LOWER(NEW.city) 
        AND id != NEW.host_id
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        user_record.id,
        'new_event_by_host',
        'New Event in Your Area! 📍',
        'A new event "' || NEW.title || '" was just posted in ' || NEW.city || '.',
        json_build_object('event_id', NEW.id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_event_in_city ON events;
CREATE TRIGGER trigger_notify_new_event_in_city
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION notify_new_event_in_city();


-- 3. Function and Trigger for event cancellations
CREATE OR REPLACE FUNCTION notify_event_cancellation()
RETURNS TRIGGER AS $$
DECLARE
  attendee_record RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    FOR attendee_record IN 
      SELECT user_id FROM event_attendees 
      WHERE event_id = NEW.id AND status = 'approved'
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        attendee_record.user_id,
        'event_cancellation',
        'Event Cancelled ⚠️',
        'The event "' || NEW.title || '" has been cancelled by the host.',
        json_build_object('event_id', NEW.id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_event_cancellation ON events;
CREATE TRIGGER trigger_notify_event_cancellation
  AFTER UPDATE OF status ON events
  FOR EACH ROW EXECUTE FUNCTION notify_event_cancellation();


-- 4. Function and Trigger for successful payment completions
CREATE OR REPLACE FUNCTION notify_payment_success()
RETURNS TRIGGER AS $$
DECLARE
  event_title TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR
     (TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed') THEN
     
    SELECT title INTO event_title FROM events WHERE id = NEW.event_id;
    
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'payment_success',
      'Payment Successful! 💳',
      'Your payment for "' || event_title || '" has been completed and your ticket is ready.',
      json_build_object('event_id', NEW.event_id, 'payment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_payment_success ON payments;
CREATE TRIGGER trigger_notify_payment_success
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION notify_payment_success();


-- 5. Function and Trigger for new reviews on events (for host alerts)
CREATE OR REPLACE FUNCTION notify_review_received()
RETURNS TRIGGER AS $$
DECLARE
  event_record RECORD;
  reviewer_name TEXT;
BEGIN
  SELECT title, host_id INTO event_record FROM events WHERE id = NEW.event_id;
  SELECT full_name INTO reviewer_name FROM profiles WHERE id = NEW.user_id;
  
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    event_record.host_id,
    'review_received',
    'New Review Received! ⭐️',
    reviewer_name || ' left a ' || NEW.event_rating || '-star review for "' || event_record.title || '".',
    json_build_object('event_id', NEW.event_id, 'review_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_review_received ON reviews;
CREATE TRIGGER trigger_notify_review_received
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION notify_review_received();


-- 6. Function and Trigger for follows
CREATE OR REPLACE FUNCTION notify_follow()
RETURNS TRIGGER AS $$
DECLARE
  follower_name TEXT;
BEGIN
  IF NEW.following_id IS NOT NULL THEN
    SELECT full_name INTO follower_name FROM profiles WHERE id = NEW.follower_id;
    
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.following_id,
      'follow_notification',
      'New Follower! 👤',
      follower_name || ' started following you.',
      json_build_object('follower_id', NEW.follower_id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_follow ON follows;
CREATE TRIGGER trigger_notify_follow
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_follow();
