-- ============================================================
-- VibeLoop — Complete PostgreSQL Schema
-- 26+ tables with PostGIS, RLS, indexes, constraints
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('guest', 'user', 'host', 'admin');
CREATE TYPE event_type AS ENUM ('public', 'private', 'invite_only');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE gender_restriction AS ENUM ('anyone', 'male_only', 'female_only', 'mixed');
CREATE TYPE approval_type AS ENUM ('instant', 'host_approval');
CREATE TYPE attendee_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE ticket_status AS ENUM ('active', 'used', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected', 'processed');
CREATE TYPE community_type AS ENUM ('public', 'private');
CREATE TYPE member_role AS ENUM ('member', 'moderator', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE verification_method AS ENUM ('aadhaar', 'pan', 'selfie');
CREATE TYPE report_reason AS ENUM ('spam', 'scam', 'harassment', 'fake_event', 'inappropriate_content', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE report_target_type AS ENUM ('user', 'event', 'community', 'chat_message');
CREATE TYPE notification_type AS ENUM (
  'event_reminder', 'join_approval', 'payment_success', 'event_cancellation',
  'new_message', 'new_event_by_host', 'community_activity', 'follow_notification',
  'review_received', 'report_update', 'system'
);
CREATE TYPE gender_type AS ENUM ('male', 'female', 'non_binary', 'prefer_not_to_say');

-- ============================================================
-- 1. PROFILES
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  date_of_birth DATE,
  gender gender_type,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  interests TEXT[] DEFAULT '{}',
  role user_role DEFAULT 'user',
  is_verified_host BOOLEAN DEFAULT FALSE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  events_attended INTEGER DEFAULT 0,
  events_hosted INTEGER DEFAULT 0,
  location GEOGRAPHY(POINT, 4326),
  phone TEXT,
  email TEXT,
  preferred_language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'dark',
  notification_preferences JSONB DEFAULT '{"push": true, "email": true, "in_app": true}'::jsonb,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON profiles USING btree (username);
CREATE INDEX idx_profiles_city ON profiles USING btree (city);
CREATE INDEX idx_profiles_role ON profiles USING btree (role);
CREATE INDEX idx_profiles_location ON profiles USING gist (location);
CREATE INDEX idx_profiles_interests ON profiles USING gin (interests);
CREATE INDEX idx_profiles_full_name_trgm ON profiles USING gin (full_name gin_trgm_ops);

-- ============================================================
-- 2. HOST VERIFICATIONS
-- ============================================================

CREATE TABLE host_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  method verification_method NOT NULL,
  document_url TEXT,
  selfie_url TEXT,
  status verification_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_host_verifications_user ON host_verifications USING btree (user_id);
CREATE INDEX idx_host_verifications_status ON host_verifications USING btree (status);

-- ============================================================
-- 3. EVENT CATEGORIES
-- ============================================================

CREATE TABLE event_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_categories_slug ON event_categories USING btree (slug);
CREATE INDEX idx_event_categories_active ON event_categories USING btree (is_active);

-- ============================================================
-- 4. EVENTS
-- ============================================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES event_categories(id),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  slug TEXT UNIQUE,
  banner_url TEXT,
  event_type event_type DEFAULT 'public',
  status event_status DEFAULT 'draft',
  event_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location GEOGRAPHY(POINT, 4326),
  max_attendees INTEGER,
  current_attendees INTEGER DEFAULT 0,
  waitlist_enabled BOOLEAN DEFAULT FALSE,
  gender_restriction gender_restriction DEFAULT 'anyone',
  min_age INTEGER DEFAULT 18,
  max_age INTEGER DEFAULT 99,
  is_free BOOLEAN DEFAULT TRUE,
  ticket_price DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  refund_policy TEXT,
  approval_type approval_type DEFAULT 'instant',
  rules TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT FALSE,
  is_trending BOOLEAN DEFAULT FALSE,
  views_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  community_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  CONSTRAINT check_event_dates CHECK (end_time > start_time),
  CONSTRAINT check_age_range CHECK (min_age >= 18 AND max_age >= min_age),
  CONSTRAINT check_price CHECK (ticket_price >= 0)
);

CREATE INDEX idx_events_host ON events USING btree (host_id);
CREATE INDEX idx_events_category ON events USING btree (category_id);
CREATE INDEX idx_events_status ON events USING btree (status);
CREATE INDEX idx_events_date ON events USING btree (event_date);
CREATE INDEX idx_events_location ON events USING gist (location);
CREATE INDEX idx_events_city ON events USING btree (city);
CREATE INDEX idx_events_type ON events USING btree (event_type);
CREATE INDEX idx_events_free ON events USING btree (is_free);
CREATE INDEX idx_events_featured ON events USING btree (is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_events_trending ON events USING btree (is_trending) WHERE is_trending = TRUE;
CREATE INDEX idx_events_slug ON events USING btree (slug);
CREATE INDEX idx_events_tags ON events USING gin (tags);
CREATE INDEX idx_events_title_trgm ON events USING gin (title gin_trgm_ops);
CREATE INDEX idx_events_community ON events USING btree (community_id);

-- ============================================================
-- 5. EVENT IMAGES
-- ============================================================

CREATE TABLE event_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_images_event ON event_images USING btree (event_id);

-- ============================================================
-- 6. EVENT ATTENDEES
-- ============================================================

CREATE TABLE event_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status attendee_status DEFAULT 'pending',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_attendees_event ON event_attendees USING btree (event_id);
CREATE INDEX idx_event_attendees_user ON event_attendees USING btree (user_id);
CREATE INDEX idx_event_attendees_status ON event_attendees USING btree (status);

-- ============================================================
-- 7. EVENT WAITLISTS
-- ============================================================

CREATE TABLE event_waitlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_waitlists_event ON event_waitlists USING btree (event_id);

-- ============================================================
-- 8. EVENT TICKETS
-- ============================================================

CREATE TABLE event_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attendee_id UUID REFERENCES event_attendees(id),
  ticket_number TEXT NOT NULL UNIQUE,
  qr_code_data TEXT NOT NULL UNIQUE,
  status ticket_status DEFAULT 'active',
  payment_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_event_tickets_event ON event_tickets USING btree (event_id);
CREATE INDEX idx_event_tickets_user ON event_tickets USING btree (user_id);
CREATE INDEX idx_event_tickets_number ON event_tickets USING btree (ticket_number);
CREATE INDEX idx_event_tickets_qr ON event_tickets USING btree (qr_code_data);
CREATE INDEX idx_event_tickets_status ON event_tickets USING btree (status);

-- ============================================================
-- 9. EVENT CHECK-INS
-- ============================================================

CREATE TABLE event_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES event_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_by UUID REFERENCES profiles(id),
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id)
);

CREATE INDEX idx_event_checkins_event ON event_checkins USING btree (event_id);

-- ============================================================
-- 10. PAYMENTS
-- ============================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status payment_status DEFAULT 'pending',
  commission_amount DECIMAL(10,2) DEFAULT 0,
  host_amount DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments USING btree (user_id);
CREATE INDEX idx_payments_event ON payments USING btree (event_id);
CREATE INDEX idx_payments_status ON payments USING btree (status);
CREATE INDEX idx_payments_razorpay_order ON payments USING btree (razorpay_order_id);

-- ============================================================
-- 11. REFUNDS
-- ============================================================

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status refund_status DEFAULT 'pending',
  razorpay_refund_id TEXT,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refunds_payment ON refunds USING btree (payment_id);
CREATE INDEX idx_refunds_status ON refunds USING btree (status);

-- ============================================================
-- 12. COMMUNITIES
-- ============================================================

CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  community_type community_type DEFAULT 'public',
  category_id UUID REFERENCES event_categories(id),
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  location GEOGRAPHY(POINT, 4326),
  members_count INTEGER DEFAULT 0,
  events_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  rules TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communities_creator ON communities USING btree (creator_id);
CREATE INDEX idx_communities_slug ON communities USING btree (slug);
CREATE INDEX idx_communities_type ON communities USING btree (community_type);
CREATE INDEX idx_communities_city ON communities USING btree (city);
CREATE INDEX idx_communities_location ON communities USING gist (location);
CREATE INDEX idx_communities_name_trgm ON communities USING gin (name gin_trgm_ops);

-- Add FK from events to communities
ALTER TABLE events ADD CONSTRAINT fk_events_community FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL;

-- ============================================================
-- 13. COMMUNITY MEMBERS
-- ============================================================

CREATE TABLE community_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

CREATE INDEX idx_community_members_community ON community_members USING btree (community_id);
CREATE INDEX idx_community_members_user ON community_members USING btree (user_id);

-- ============================================================
-- 14. COMMUNITY POSTS
-- ============================================================

CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  is_announcement BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_community_posts_community ON community_posts USING btree (community_id);
CREATE INDEX idx_community_posts_author ON community_posts USING btree (author_id);
CREATE INDEX idx_community_posts_pinned ON community_posts USING btree (is_pinned) WHERE is_pinned = TRUE;

-- ============================================================
-- 15. COMMUNITY EVENTS (linking table)
-- ============================================================

CREATE TABLE community_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, event_id)
);

CREATE INDEX idx_community_events_community ON community_events USING btree (community_id);

-- ============================================================
-- 16. CHAT ROOMS
-- ============================================================

CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('event', 'community', 'direct')),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  members_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_rooms_event ON chat_rooms USING btree (event_id);
CREATE INDEX idx_chat_rooms_community ON chat_rooms USING btree (community_id);
CREATE INDEX idx_chat_rooms_type ON chat_rooms USING btree (type);
CREATE INDEX idx_chat_rooms_last_message ON chat_rooms USING btree (last_message_at DESC);

-- ============================================================
-- 17. CHAT MESSAGES
-- ============================================================

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_size INTEGER,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  reply_to UUID REFERENCES chat_messages(id),
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_room ON chat_messages USING btree (room_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages USING btree (sender_id);
CREATE INDEX idx_chat_messages_created ON chat_messages USING btree (created_at DESC);
CREATE INDEX idx_chat_messages_room_created ON chat_messages USING btree (room_id, created_at DESC);

-- ============================================================
-- 18. SAVED EVENTS
-- ============================================================

CREATE TABLE saved_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

CREATE INDEX idx_saved_events_user ON saved_events USING btree (user_id);

-- ============================================================
-- 19. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications USING btree (user_id);
CREATE INDEX idx_notifications_unread ON notifications USING btree (user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications USING btree (created_at DESC);

-- ============================================================
-- 20. REVIEWS
-- ============================================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_rating INTEGER NOT NULL CHECK (event_rating BETWEEN 1 AND 5),
  host_rating INTEGER CHECK (host_rating BETWEEN 1 AND 5),
  venue_rating INTEGER CHECK (venue_rating BETWEEN 1 AND 5),
  comment TEXT,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_reviews_event ON reviews USING btree (event_id);
CREATE INDEX idx_reviews_user ON reviews USING btree (user_id);

-- ============================================================
-- 21. FOLLOWS
-- ============================================================

CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_follow_target CHECK (
    (following_id IS NOT NULL AND community_id IS NULL) OR
    (following_id IS NULL AND community_id IS NOT NULL)
  ),
  UNIQUE(follower_id, following_id),
  UNIQUE(follower_id, community_id)
);

CREATE INDEX idx_follows_follower ON follows USING btree (follower_id);
CREATE INDEX idx_follows_following ON follows USING btree (following_id);
CREATE INDEX idx_follows_community ON follows USING btree (community_id);

-- ============================================================
-- 22. REPORTS
-- ============================================================

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type report_target_type NOT NULL,
  target_id UUID NOT NULL,
  reason report_reason NOT NULL,
  description TEXT,
  status report_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_reporter ON reports USING btree (reporter_id);
CREATE INDEX idx_reports_status ON reports USING btree (status);
CREATE INDEX idx_reports_target ON reports USING btree (target_type, target_id);

-- ============================================================
-- 23. AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs USING btree (user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs USING btree (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs USING btree (created_at DESC);

-- ============================================================
-- 24. ADMIN ACTIONS
-- ============================================================

CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_admin ON admin_actions USING btree (admin_id);
CREATE INDEX idx_admin_actions_target ON admin_actions USING btree (target_type, target_id);

-- ============================================================
-- 25. CHAT ROOM MEMBERS (for tracking presence)
-- ============================================================

CREATE TABLE chat_room_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_chat_room_members_room ON chat_room_members USING btree (room_id);
CREATE INDEX idx_chat_room_members_user ON chat_room_members USING btree (user_id);

-- ============================================================
-- 26. POST LIKES (for community posts)
-- ============================================================

CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post ON post_likes USING btree (post_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'profiles', 'host_verifications', 'event_categories', 'events',
      'payments', 'refunds', 'communities', 'community_posts',
      'chat_rooms', 'chat_messages', 'reviews', 'reports'
    ])
  LOOP
    EXECUTE format('
      CREATE TRIGGER trigger_updated_at_%I
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END;
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to increment/decrement counters
CREATE OR REPLACE FUNCTION update_event_attendee_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    UPDATE events SET current_attendees = current_attendees + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' THEN
    UPDATE events SET current_attendees = current_attendees + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status != 'approved' THEN
    UPDATE events SET current_attendees = current_attendees - 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE events SET current_attendees = current_attendees - 1 WHERE id = OLD.event_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_attendee_count
  AFTER INSERT OR UPDATE OR DELETE ON event_attendees
  FOR EACH ROW EXECUTE FUNCTION update_event_attendee_count();

-- Function to update community member count
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE communities SET members_count = members_count + 1 WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE communities SET members_count = members_count - 1 WHERE id = OLD.community_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_member_count
  AFTER INSERT OR DELETE ON community_members
  FOR EACH ROW EXECUTE FUNCTION update_community_member_count();

-- Function to update follower counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    IF NEW.following_id IS NOT NULL THEN
      UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    IF OLD.following_id IS NOT NULL THEN
      UPDATE profiles SET followers_count = followers_count - 1 WHERE id = OLD.following_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Function for nearby events search
CREATE OR REPLACE FUNCTION search_nearby_events(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km INTEGER DEFAULT 10,
  category_filter UUID DEFAULT NULL,
  free_only BOOLEAN DEFAULT FALSE,
  result_limit INTEGER DEFAULT 20,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  event_id UUID,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS event_id,
    ST_Distance(
      e.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
    ) / 1000.0 AS distance_km
  FROM events e
  WHERE e.status = 'published'
    AND e.event_date >= CURRENT_DATE
    AND ST_DWithin(
      e.location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
    AND (category_filter IS NULL OR e.category_id = category_filter)
    AND (NOT free_only OR e.is_free = TRUE)
  ORDER BY distance_km ASC
  LIMIT result_limit OFFSET result_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update event average rating
CREATE OR REPLACE FUNCTION update_event_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE events SET
    avg_rating = (SELECT AVG(event_rating) FROM reviews WHERE event_id = NEW.event_id AND is_visible = TRUE),
    reviews_count = (SELECT COUNT(*) FROM reviews WHERE event_id = NEW.event_id AND is_visible = TRUE)
  WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_event_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_event_rating();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_waitlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ---- EVENT CATEGORIES ----
CREATE POLICY "Categories are viewable by everyone" ON event_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON event_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ---- EVENTS ----
CREATE POLICY "Published events are viewable by everyone" ON events FOR SELECT USING (
  status = 'published' OR host_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Hosts can create events" ON events FOR INSERT WITH CHECK (
  auth.uid() = host_id AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('host', 'admin'))
);
CREATE POLICY "Hosts can update own events" ON events FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "Hosts can delete own events" ON events FOR DELETE USING (host_id = auth.uid());

-- ---- EVENT IMAGES ----
CREATE POLICY "Event images are viewable by everyone" ON event_images FOR SELECT USING (true);
CREATE POLICY "Hosts can manage event images" ON event_images FOR ALL USING (
  EXISTS (SELECT 1 FROM events WHERE id = event_id AND host_id = auth.uid())
);

-- ---- EVENT ATTENDEES ----
CREATE POLICY "Attendees viewable by event host and attendee" ON event_attendees FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND host_id = auth.uid())
);
CREATE POLICY "Users can join events" ON event_attendees FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can cancel own attendance" ON event_attendees FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Hosts can manage attendees" ON event_attendees FOR UPDATE USING (
  EXISTS (SELECT 1 FROM events WHERE id = event_id AND host_id = auth.uid())
);

-- ---- EVENT WAITLISTS ----
CREATE POLICY "Users can view own waitlist" ON event_waitlists FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can join waitlist" ON event_waitlists FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---- EVENT TICKETS ----
CREATE POLICY "Users can view own tickets" ON event_tickets FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND host_id = auth.uid())
);
CREATE POLICY "System can create tickets" ON event_tickets FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---- EVENT CHECK-INS ----
CREATE POLICY "Hosts can manage check-ins" ON event_checkins FOR ALL USING (
  EXISTS (SELECT 1 FROM events WHERE id = event_id AND host_id = auth.uid())
);
CREATE POLICY "Users can view own check-ins" ON event_checkins FOR SELECT USING (user_id = auth.uid());

-- ---- PAYMENTS ----
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND host_id = auth.uid())
);
CREATE POLICY "Users can create payments" ON payments FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---- REFUNDS ----
CREATE POLICY "Users can view own refunds" ON refunds FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can request refunds" ON refunds FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---- COMMUNITIES ----
CREATE POLICY "Public communities are viewable by everyone" ON communities FOR SELECT USING (
  community_type = 'public' OR creator_id = auth.uid()
  OR EXISTS (SELECT 1 FROM community_members WHERE community_id = id AND user_id = auth.uid())
);
CREATE POLICY "Users can create communities" ON communities FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update communities" ON communities FOR UPDATE USING (creator_id = auth.uid());

-- ---- COMMUNITY MEMBERS ----
CREATE POLICY "Members are viewable by community members" ON community_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members cm WHERE cm.community_id = community_id AND cm.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.community_type = 'public')
);
CREATE POLICY "Users can join communities" ON community_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can leave communities" ON community_members FOR DELETE USING (user_id = auth.uid());

-- ---- COMMUNITY POSTS ----
CREATE POLICY "Posts viewable by community members" ON community_posts FOR SELECT USING (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = community_posts.community_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM communities WHERE id = community_id AND community_type = 'public')
);
CREATE POLICY "Members can create posts" ON community_posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM community_members WHERE community_id = community_posts.community_id AND user_id = auth.uid())
);
CREATE POLICY "Authors can update own posts" ON community_posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Authors can delete own posts" ON community_posts FOR DELETE USING (author_id = auth.uid());

-- ---- COMMUNITY EVENTS ----
CREATE POLICY "Community events viewable by everyone" ON community_events FOR SELECT USING (true);

-- ---- CHAT ROOMS ----
CREATE POLICY "Chat rooms viewable by members" ON chat_rooms FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = id AND user_id = auth.uid())
);

-- ---- CHAT MESSAGES ----
CREATE POLICY "Messages viewable by room members" ON chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = chat_messages.room_id AND user_id = auth.uid())
);
CREATE POLICY "Members can send messages" ON chat_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = chat_messages.room_id AND user_id = auth.uid())
);
CREATE POLICY "Senders can edit own messages" ON chat_messages FOR UPDATE USING (sender_id = auth.uid());

-- ---- CHAT ROOM MEMBERS ----
CREATE POLICY "Room members viewable by room members" ON chat_room_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_room_members crm WHERE crm.room_id = room_id AND crm.user_id = auth.uid())
);

-- ---- SAVED EVENTS ----
CREATE POLICY "Users can view own saved events" ON saved_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can save events" ON saved_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can unsave events" ON saved_events FOR DELETE USING (user_id = auth.uid());

-- ---- NOTIFICATIONS ----
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- ---- REVIEWS ----
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (is_visible = true);
CREATE POLICY "Attendees can create reviews" ON reviews FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (SELECT 1 FROM event_attendees WHERE event_id = reviews.event_id AND user_id = auth.uid() AND status = 'approved')
);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (user_id = auth.uid());

-- ---- FOLLOWS ----
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (follower_id = auth.uid());

-- ---- REPORTS ----
CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (
  reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- ---- AUDIT LOGS ----
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ---- ADMIN ACTIONS ----
CREATE POLICY "Admins can manage admin actions" ON admin_actions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ---- HOST VERIFICATIONS ----
CREATE POLICY "Users can view own verifications" ON host_verifications FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can submit verifications" ON host_verifications FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---- POST LIKES ----
CREATE POLICY "Likes are viewable by everyone" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts" ON post_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can unlike posts" ON post_likes FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- SEED DATA: Default Categories
-- ============================================================

INSERT INTO event_categories (name, slug, icon, color, sort_order) VALUES
  ('Gaming', 'gaming', '🎮', '#6C5CE7', 1),
  ('Cricket', 'cricket', '🏏', '#00B894', 2),
  ('Football', 'football', '⚽', '#0984E3', 3),
  ('Badminton', 'badminton', '🏸', '#FDCB6E', 4),
  ('Running', 'running', '🏃', '#E17055', 5),
  ('Cycling', 'cycling', '🚴', '#00CEC9', 6),
  ('Yoga', 'yoga', '🧘', '#A29BFE', 7),
  ('Fitness', 'fitness', '💪', '#FF7675', 8),
  ('Coding', 'coding', '💻', '#2D3436', 9),
  ('Startup Networking', 'startup-networking', '🚀', '#6C5CE7', 10),
  ('Photography', 'photography', '📸', '#FFEAA7', 11),
  ('Music', 'music', '🎵', '#E84393', 12),
  ('Dance', 'dance', '💃', '#FD79A8', 13),
  ('Travel', 'travel', '✈️', '#00B894', 14),
  ('Book Clubs', 'book-clubs', '📚', '#FDCB6E', 15),
  ('Workshops', 'workshops', '🛠️', '#0984E3', 16),
  ('Language Exchange', 'language-exchange', '🗣️', '#00CEC9', 17),
  ('House Parties', 'house-parties', '🏠', '#E17055', 18),
  ('Board Games', 'board-games', '🎲', '#A29BFE', 19);

-- ============================================================
-- REALTIME CONFIGURATION
-- ============================================================

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE event_attendees;
