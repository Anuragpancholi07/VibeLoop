// ============================================================
// VibeLoop — Shared TypeScript Types
// ============================================================

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null;
  city: string | null;
  state: string | null;
  country: string;
  interests: string[];
  role: UserRole;
  is_verified_host: boolean;
  followers_count: number;
  following_count: number;
  events_attended: number;
  events_hosted: number;
  phone: string | null;
  email: string | null;
  preferred_language: string;
  theme: string;
  notification_preferences: NotificationPreferences;
  onboarding_completed: boolean;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'guest' | 'user' | 'host' | 'admin';

export interface NotificationPreferences {
  push: boolean;
  email: boolean;
  in_app: boolean;
}

export interface EventCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  event_count: number;
  created_at: string;
}

export interface Event {
  id: string;
  host_id: string;
  category_id: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  slug: string | null;
  banner_url: string | null;
  event_type: 'public' | 'private' | 'invite_only';
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  event_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  max_attendees: number | null;
  current_attendees: number;
  waitlist_enabled: boolean;
  gender_restriction: 'anyone' | 'male_only' | 'female_only' | 'mixed';
  min_age: number;
  max_age: number;
  is_free: boolean;
  ticket_price: number;
  currency: string;
  refund_policy: string | null;
  approval_type: 'instant' | 'host_approval';
  rules: string[];
  tags: string[];
  is_featured: boolean;
  is_trending: boolean;
  views_count: number;
  saves_count: number;
  shares_count: number;
  avg_rating: number;
  reviews_count: number;
  community_id: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  // Joined fields
  host?: Profile;
  category?: EventCategory;
  images?: EventImage[];
  distance_km?: number;
  is_saved?: boolean;
  attendee_status?: string | null;
}

export interface EventImage {
  id: string;
  event_id: string;
  image_url: string;
  sort_order: number;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  joined_at: string;
  approved_at: string | null;
  profile?: Profile;
}

export interface EventTicket {
  id: string;
  event_id: string;
  user_id: string;
  ticket_number: string;
  qr_code_data: string;
  status: 'active' | 'used' | 'cancelled' | 'refunded';
  payment_id: string | null;
  created_at: string;
  used_at: string | null;
  event?: Event;
}

export interface Payment {
  id: string;
  user_id: string;
  event_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  commission_amount: number;
  host_amount: number;
  created_at: string;
  event?: Event;
}

export interface Community {
  id: string;
  creator_id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  community_type: 'public' | 'private';
  category_id: string | null;
  city: string | null;
  members_count: number;
  events_count: number;
  posts_count: number;
  is_active: boolean;
  rules: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  creator?: Profile;
  category?: EventCategory;
  is_member?: boolean;
}

export interface CommunityPost {
  id: string;
  community_id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  is_announcement: boolean;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author?: Profile;
  is_liked?: boolean;
}

export interface ChatRoom {
  id: string;
  name: string | null;
  type: 'event' | 'community' | 'direct';
  event_id: string | null;
  community_id: string | null;
  is_active: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  members_count: number;
  created_at: string;
  event?: Event;
  community?: Community;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'file' | 'system';
  attachment_url: string | null;
  attachment_name: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  reply_to: string | null;
  read_by: string[];
  created_at: string;
  sender?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  event_id: string;
  user_id: string;
  event_rating: number;
  host_rating: number | null;
  venue_rating: number | null;
  comment: string | null;
  created_at: string;
  user?: Profile;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string | null;
  community_id: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: 'user' | 'event' | 'community' | 'chat_message';
  target_id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
}

// Query types
export interface EventFilters {
  search?: string;
  category?: string;
  city?: string;
  isFree?: boolean;
  dateFrom?: string;
  dateTo?: string;
  gender?: string;
  radius?: number;
  lat?: number;
  lng?: number;
  sortBy?: 'trending' | 'popular' | 'closest' | 'newest';
}

export interface PaginationParams {
  page: number;
  limit: number;
}
