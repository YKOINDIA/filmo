/**
 * Legacy compatibility layer.
 * Filmo has migrated from Appwrite to Supabase.
 * This file re-exports Supabase utilities for files that still import from appwrite.ts.
 */
export { getSupabase as default } from './supabase'
export { getSupabaseAdmin as createAdminClient } from './supabase-admin'

// Collection names (kept for reference — Supabase uses these as table names directly)
export const COLLECTIONS = {
  USERS: 'users',
  MOVIES: 'movies',
  EPISODES: 'episodes',
  WATCHLISTS: 'watchlists',
  EPISODE_WATCHES: 'episode_watches',
  REVIEWS: 'reviews',
  LIKES: 'likes',
  FOLLOWS: 'follows',
  ACTORS: 'actors',
  DIRECTORS: 'directors',
  FANS: 'fans',
  NOTIFICATIONS: 'notifications',
  STREAMING_SERVICES: 'streaming_services',
  STREAMING_AVAILABILITY: 'streaming_availability',
  THEATER_SHOWINGS: 'theater_showings',
  TV_SCHEDULES: 'tv_schedules',
  ANNOUNCEMENTS: 'announcements',
  USER_NOTIFICATIONS: 'user_notifications',
  REVIEW_REPORTS: 'review_reports',
  X_POST_DRAFTS: 'x_post_drafts',
  ADMIN_ALERTS: 'admin_alerts',
  ACCESS_LOGS: 'access_logs',
  CRON_SETTINGS: 'cron_settings',
  CAMPAIGN_COUPONS: 'campaign_coupons',
  FEEDBACK_THREADS: 'feedback_threads',
  FEEDBACK_MESSAGES: 'feedback_messages',
  USER_POINTS: 'user_points',
  USER_TITLES: 'user_titles',
  USER_EARNED_TITLES: 'user_earned_titles',
  MONTHLY_BONUSES: 'monthly_bonuses',
  DAILY_LIKE_COUNTS: 'daily_like_counts',
  VOICE_REVIEWS: 'voice_reviews',
  VOICE_REACTIONS: 'voice_reactions',
} as const

export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  IMAGES: 'images',
  VOICE_REVIEWS: 'voice-reviews',
} as const
