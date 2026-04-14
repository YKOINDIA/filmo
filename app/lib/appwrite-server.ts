/**
 * Legacy compatibility layer for server-side.
 * Filmo has migrated from Appwrite to Supabase.
 */
export { getSupabaseAdmin as createAdminClient } from './supabase-admin'
export { getSupabaseServerClient } from './supabase-server'
export { COLLECTIONS } from './appwrite'
