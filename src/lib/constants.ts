export const APP_NAME = 'VibeLoop';
export const APP_TAGLINE = 'Discover. Connect. Experience.';
export const APP_DESCRIPTION = 'Find amazing events, build communities, and make real connections near you.';

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

export const DEFAULT_CURRENCY = 'INR';
export const MIN_AGE = 18;
export const MAX_AGE = 99;

export const RADIUS_OPTIONS = [
  { value: 5, label: '5 KM' },
  { value: 10, label: '10 KM' },
  { value: 25, label: '25 KM' },
  { value: 50, label: '50 KM' },
];

export const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'popular', label: 'Popular' },
  { value: 'closest', label: 'Closest' },
  { value: 'newest', label: 'Newest' },
];

export const GENDER_OPTIONS = [
  { value: 'anyone', label: 'Anyone' },
  { value: 'male_only', label: 'Male Only' },
  { value: 'female_only', label: 'Female Only' },
  { value: 'mixed', label: 'Mixed' },
];

export const EVENT_TYPES = [
  { value: 'public', label: 'Public', description: 'Anyone can discover and join' },
  { value: 'private', label: 'Private', description: 'Only invited people can see' },
  { value: 'invite_only', label: 'Invite Only', description: 'Join by invitation only' },
];

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'scam', label: 'Scam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'fake_event', label: 'Fake Event' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'other', label: 'Other' },
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_GALLERY_IMAGES = 10;

export const ITEMS_PER_PAGE = 20;
