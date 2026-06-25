-- Migration 008: Real-time Host Notifications for Attendee actions

-- 1. Replace notify_attendee_status_change() to cover both attendee & host notification scenarios
CREATE OR REPLACE FUNCTION notify_attendee_status_change()
RETURNS TRIGGER AS $$
DECLARE
  event_record RECORD;
  attendee_name TEXT;
  active_user_id UUID;
BEGIN
  -- Fetch event details
  SELECT host_id, title INTO event_record FROM events WHERE id = NEW.event_id;
  -- Fetch attendee's name
  SELECT full_name INTO attendee_name FROM profiles WHERE id = NEW.user_id;
  attendee_name := COALESCE(attendee_name, 'Someone');
  
  -- Safe retrieval of active user executing the action
  active_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  -- 1.1 NOTIFY ATTENDEE ON HOST APPROVAL/REJECTION (when status is changed by host/system, not user themselves)
  -- Notify attendee if they are approved by the host
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved' AND NEW.user_id != active_user_id) OR
     (TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' AND NEW.user_id != active_user_id) THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'join_approval',
      'Join Request Approved! 🎉',
      'Your request to join "' || event_record.title || '" has been approved by the host.',
      json_build_object('event_id', NEW.event_id, 'attendee_id', NEW.id)
    );
  -- Notify attendee if they are rejected by the host
  ELSIF (TG_OP = 'UPDATE' AND OLD.status != 'rejected' AND NEW.status = 'rejected' AND NEW.user_id != active_user_id) THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'event_cancellation',
      'Join Request Rejected',
      'Your request to join "' || event_record.title || '" was not approved by the host.',
      json_build_object('event_id', NEW.event_id, 'attendee_id', NEW.id)
    );
  END IF;

  -- 1.2 NOTIFY HOST ON ATTENDEE ACTIONS (only if attendee is not the host themselves)
  IF NEW.user_id != event_record.host_id THEN
    -- When a user requests to join (status = 'pending')
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') OR
       (TG_OP = 'UPDATE' AND OLD.status != 'pending' AND NEW.status = 'pending') THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        event_record.host_id,
        'community_activity',
        'New Join Request! 📥',
        attendee_name || ' has requested to join your event "' || event_record.title || '". Approval required.',
        json_build_object('event_id', NEW.event_id, 'attendee_id', NEW.id, 'user_id', NEW.user_id)
      );
    -- When a user joins instantly (status = 'approved' and it was triggered by the user themselves)
    ELSIF (TG_OP = 'INSERT' AND NEW.status = 'approved' AND NEW.user_id = active_user_id) THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        event_record.host_id,
        'community_activity',
        'New Attendee Joined! 👤',
        attendee_name || ' has registered for your event "' || event_record.title || '".',
        json_build_object('event_id', NEW.event_id, 'attendee_id', NEW.id, 'user_id', NEW.user_id)
      );
    -- When a user cancels their attendance/request
    ELSIF (TG_OP = 'UPDATE' AND OLD.status != 'cancelled' AND NEW.status = 'cancelled' AND NEW.user_id = active_user_id) THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        event_record.host_id,
        'community_activity',
        'Attendee Cancelled 😞',
        attendee_name || ' has cancelled their attendance for your event "' || event_record.title || '".',
        json_build_object('event_id', NEW.event_id, 'attendee_id', NEW.id, 'user_id', NEW.user_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Replace notify_payment_success() to notify both attendee and host
CREATE OR REPLACE FUNCTION notify_payment_success()
RETURNS TRIGGER AS $$
DECLARE
  event_record RECORD;
  attendee_name TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR
     (TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed') THEN
     
    SELECT host_id, title INTO event_record FROM events WHERE id = NEW.event_id;
    SELECT full_name INTO attendee_name FROM profiles WHERE id = NEW.user_id;
    attendee_name := COALESCE(attendee_name, 'Someone');
    
    -- Notify attendee
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'payment_success',
      'Payment Successful! 💳',
      'Your payment for "' || event_record.title || '" has been completed and your ticket is ready.',
      json_build_object('event_id', NEW.event_id, 'payment_id', NEW.id)
    );

    -- Notify host (only if the attendee is not the host itself)
    IF NEW.user_id != event_record.host_id THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        event_record.host_id,
        'community_activity',
        'New Ticket Purchased! 🎟️',
        attendee_name || ' paid ' || NEW.currency || ' ' || NEW.amount || ' and registered for your event "' || event_record.title || '".',
        json_build_object('event_id', NEW.event_id, 'payment_id', NEW.id, 'user_id', NEW.user_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Create notify_waitlist_signup() trigger function and trigger
CREATE OR REPLACE FUNCTION notify_waitlist_signup()
RETURNS TRIGGER AS $$
DECLARE
  event_record RECORD;
  attendee_name TEXT;
BEGIN
  SELECT host_id, title INTO event_record FROM events WHERE id = NEW.event_id;
  SELECT full_name INTO attendee_name FROM profiles WHERE id = NEW.user_id;
  attendee_name := COALESCE(attendee_name, 'Someone');

  -- Notify Host (only if waitlisted user is not the host itself)
  IF NEW.user_id != event_record.host_id THEN
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      event_record.host_id,
      'community_activity',
      'New Waitlist Signup! ⏳',
      attendee_name || ' joined the waitlist for your event "' || event_record.title || '" (Position: ' || NEW.position || ').',
      json_build_object('event_id', NEW.event_id, 'waitlist_id', NEW.id, 'user_id', NEW.user_id)
    );
  END IF;

  -- Notify Attendee
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.user_id,
    'community_activity',
    'Waitlist Joined ⏳',
    'You joined the waitlist for "' || event_record.title || '". We will notify you if a spot opens up.',
    json_build_object('event_id', NEW.event_id, 'waitlist_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_waitlist_signup ON event_waitlists;
CREATE TRIGGER trigger_notify_waitlist_signup
  AFTER INSERT ON event_waitlists
  FOR EACH ROW EXECUTE FUNCTION notify_waitlist_signup();
