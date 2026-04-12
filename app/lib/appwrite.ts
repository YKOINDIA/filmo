import { Client, Account, Databases, Storage, Query, ID } from 'appwrite'

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)

export const account = new Account(client)
export const databases = new Databases(client)
export const storage = new Storage(client)
export { Query, ID, client }

// Database & Collection IDs
export const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'filmo_db'

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
} as const

export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  IMAGES: 'images',
} as const

// Helper: get user document
export async function getUserDoc(userId: string) {
  try {
    return await databases.getDocument(DB_ID, COLLECTIONS.USERS, userId)
  } catch {
    return null
  }
}

// Helper: list documents with query
export async function listDocs(collectionId: string, queries: string[] = [], limit = 25) {
  return databases.listDocuments(DB_ID, collectionId, [...queries, Query.limit(limit)])
}
