/**
 * Filmo - Appwrite Database Setup Script
 *
 * Creates the database, all 30 collections with their attributes,
 * and the avatars storage bucket.
 *
 * Usage: node scripts/setup-appwrite.mjs
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_APPWRITE_ENDPOINT
 *   NEXT_PUBLIC_APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY
 *   NEXT_PUBLIC_APPWRITE_DATABASE_ID  (defaults to "filmo_db")
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  Client,
  Databases,
  Storage,
  Permission,
  Role,
  ID,
} from "node-appwrite";

// ── Load .env.local ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

function loadEnv(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // strip surrounding quotes
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    console.error(`Could not read ${filePath}. Make sure .env.local exists.`);
    process.exit(1);
  }
}

loadEnv(envPath);

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "filmo_db";

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error(
    "Missing required env vars: NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY"
  );
  process.exit(1);
}

// ── Appwrite client ──────────────────────────────────────────────────────────
const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isAlreadyExists(err) {
  return (
    err?.code === 409 ||
    err?.type === "document_already_exists" ||
    err?.type === "collection_already_exists" ||
    err?.type === "database_already_exists" ||
    err?.type === "storage_bucket_already_exists" ||
    err?.type === "attribute_already_exists" ||
    (err?.message && err.message.includes("already exists"))
  );
}

// ── Attribute definitions ────────────────────────────────────────────────────
// Types: "string", "integer", "float", "boolean", "email"
// Each entry: { key, type, size?, default?, required? }

const COLLECTIONS = {
  users: [
    { key: "name", type: "string", size: 100 },
    { key: "email", type: "email" },
    { key: "avatar_url", type: "string", size: 500 },
    { key: "bio", type: "string", size: 1000 },
    { key: "points", type: "integer", default: 0 },
    { key: "level", type: "integer", default: 1 },
    { key: "login_streak", type: "integer", default: 0 },
    { key: "last_login_date", type: "string", size: 20 },
    { key: "best_movie_id", type: "integer" },
    { key: "best_movie_title", type: "string", size: 200 },
    { key: "best_movie_poster", type: "string", size: 500 },
    { key: "is_banned", type: "boolean", default: false },
    { key: "notify_follow", type: "boolean", default: true },
    { key: "notify_like", type: "boolean", default: true },
    { key: "notify_reply", type: "boolean", default: true },
    { key: "notify_new_work", type: "boolean", default: true },
    { key: "notify_announcement", type: "boolean", default: true },
    { key: "notify_recommend", type: "boolean", default: true },
  ],
  movies: [
    { key: "tmdb_id", type: "integer" },
    { key: "title", type: "string", size: 300 },
    { key: "original_title", type: "string", size: 300 },
    { key: "poster_path", type: "string", size: 500 },
    { key: "backdrop_path", type: "string", size: 500 },
    { key: "release_date", type: "string", size: 20 },
    { key: "vote_average", type: "float" },
    { key: "overview", type: "string", size: 5000 },
    { key: "work_type", type: "string", size: 20 },
    { key: "genres", type: "string", size: 2000 },
    { key: "production_countries", type: "string", size: 2000 },
  ],
  episodes: [
    { key: "movie_id", type: "integer" },
    { key: "season_number", type: "integer" },
    { key: "episode_number", type: "integer" },
    { key: "name", type: "string", size: 300 },
    { key: "air_date", type: "string", size: 20 },
  ],
  watchlists: [
    { key: "user_id", type: "string", size: 50 },
    { key: "movie_id", type: "integer" },
    { key: "work_type", type: "string", size: 20 },
    { key: "status", type: "string", size: 30 },
    { key: "score", type: "float" },
    { key: "watched_at", type: "string", size: 30 },
    { key: "watch_method", type: "string", size: 50 },
  ],
  episode_watches: [
    { key: "user_id", type: "string", size: 50 },
    { key: "movie_id", type: "integer" },
    { key: "season_number", type: "integer" },
    { key: "episode_number", type: "integer" },
    { key: "watched", type: "boolean", default: false },
  ],
  reviews: [
    { key: "user_id", type: "string", size: 50 },
    { key: "movie_id", type: "integer" },
    { key: "work_type", type: "string", size: 20 },
    { key: "score", type: "float" },
    { key: "body", type: "string", size: 10000 },
    { key: "has_spoiler", type: "boolean", default: false },
    { key: "is_draft", type: "boolean", default: false },
    { key: "is_hidden", type: "boolean", default: false },
    { key: "likes_count", type: "integer", default: 0 },
  ],
  likes: [
    { key: "user_id", type: "string", size: 50 },
    { key: "review_id", type: "string", size: 50 },
  ],
  follows: [
    { key: "follower_id", type: "string", size: 50 },
    { key: "following_id", type: "string", size: 50 },
  ],
  actors: [
    { key: "tmdb_id", type: "integer" },
    { key: "name", type: "string", size: 200 },
    { key: "profile_path", type: "string", size: 500 },
  ],
  directors: [
    { key: "tmdb_id", type: "integer" },
    { key: "name", type: "string", size: 200 },
    { key: "profile_path", type: "string", size: 500 },
  ],
  fans: [
    { key: "user_id", type: "string", size: 50 },
    { key: "person_id", type: "integer" },
    { key: "person_type", type: "string", size: 20 },
    { key: "person_name", type: "string", size: 200 },
  ],
  notifications: [
    { key: "user_id", type: "string", size: 50 },
    { key: "type", type: "string", size: 50 },
    { key: "title", type: "string", size: 300 },
    { key: "body", type: "string", size: 1000 },
    { key: "is_read", type: "boolean", default: false },
    { key: "related_id", type: "string", size: 100 },
    { key: "related_type", type: "string", size: 50 },
  ],
  streaming_services: [
    { key: "name", type: "string", size: 100 },
    { key: "logo_url", type: "string", size: 500 },
    { key: "url", type: "string", size: 500 },
  ],
  streaming_availability: [
    { key: "movie_id", type: "integer" },
    { key: "service_id", type: "string", size: 50 },
    { key: "url", type: "string", size: 500 },
  ],
  theater_showings: [
    { key: "movie_id", type: "integer" },
    { key: "theater_name", type: "string", size: 200 },
    { key: "area", type: "string", size: 100 },
    { key: "start_date", type: "string", size: 20 },
    { key: "end_date", type: "string", size: 20 },
  ],
  tv_schedules: [
    { key: "movie_id", type: "integer" },
    { key: "channel", type: "string", size: 100 },
    { key: "air_datetime", type: "string", size: 30 },
    { key: "is_rerun", type: "boolean", default: false },
  ],
  announcements: [
    { key: "title", type: "string", size: 300 },
    { key: "body", type: "string", size: 5000 },
    { key: "category", type: "string", size: 50 },
    { key: "is_active", type: "boolean", default: true },
    { key: "priority", type: "integer", default: 0 },
  ],
  user_notifications: [
    { key: "user_id", type: "string", size: 50 },
    { key: "announcement_id", type: "string", size: 50 },
    { key: "is_read", type: "boolean", default: false },
  ],
  review_reports: [
    { key: "review_id", type: "string", size: 50 },
    { key: "reporter_id", type: "string", size: 50 },
    { key: "reason", type: "string", size: 50 },
    { key: "detail", type: "string", size: 1000 },
    { key: "status", type: "string", size: 30, default: "pending" },
  ],
  x_post_drafts: [
    { key: "body", type: "string", size: 500 },
    { key: "movie_title", type: "string", size: 300 },
    { key: "score", type: "float" },
    { key: "status", type: "string", size: 30, default: "draft" },
    { key: "posted_at", type: "string", size: 30 },
  ],
  admin_alerts: [
    { key: "type", type: "string", size: 50 },
    { key: "message", type: "string", size: 1000 },
    { key: "severity", type: "string", size: 20 },
    { key: "is_resolved", type: "boolean", default: false },
  ],
  access_logs: [
    { key: "user_id", type: "string", size: 50 },
    { key: "ip", type: "string", size: 50 },
    { key: "path", type: "string", size: 200 },
    { key: "method", type: "string", size: 10 },
    { key: "ua", type: "string", size: 500 },
  ],
  cron_settings: [
    { key: "path", type: "string", size: 200 },
    { key: "enabled", type: "boolean", default: true },
    { key: "last_run", type: "string", size: 30 },
  ],
  campaign_coupons: [
    { key: "code", type: "string", size: 50 },
    { key: "description", type: "string", size: 500 },
    { key: "discount_type", type: "string", size: 20 },
    { key: "discount_value", type: "float" },
    { key: "valid_from", type: "string", size: 30 },
    { key: "valid_to", type: "string", size: 30 },
    { key: "max_uses", type: "integer", default: 0 },
    { key: "used_count", type: "integer", default: 0 },
    { key: "is_active", type: "boolean", default: true },
  ],
  feedback_threads: [
    { key: "user_id", type: "string", size: 50 },
    { key: "category", type: "string", size: 50 },
    { key: "subject", type: "string", size: 300 },
    { key: "status", type: "string", size: 30, default: "open" },
    { key: "unread_admin", type: "boolean", default: false },
  ],
  feedback_messages: [
    { key: "thread_id", type: "string", size: 50 },
    { key: "body", type: "string", size: 5000 },
    { key: "is_admin", type: "boolean", default: false },
  ],
  user_points: [
    { key: "user_id", type: "string", size: 50 },
    { key: "points", type: "integer" },
    { key: "reason", type: "string", size: 300 },
  ],
  user_titles: [
    { key: "name", type: "string", size: 100 },
    { key: "description", type: "string", size: 500 },
    { key: "category", type: "string", size: 50 },
    { key: "condition_type", type: "string", size: 50 },
    { key: "condition_value", type: "integer" },
    { key: "is_secret", type: "boolean", default: false },
  ],
  user_earned_titles: [
    { key: "user_id", type: "string", size: 50 },
    { key: "title_id", type: "string", size: 50 },
    { key: "earned_at", type: "string", size: 30 },
  ],
  monthly_bonuses: [
    { key: "user_id", type: "string", size: 50 },
    { key: "year_month", type: "string", size: 10 },
    { key: "claimed", type: "boolean", default: false },
  ],
  daily_like_counts: [
    { key: "user_id", type: "string", size: 50 },
    { key: "date", type: "string", size: 10 },
    { key: "count", type: "integer", default: 0 },
  ],
};

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Filmo Appwrite Setup ===");
  console.log(`Endpoint : ${ENDPOINT}`);
  console.log(`Project  : ${PROJECT_ID}`);
  console.log(`Database : ${DATABASE_ID}`);
  console.log("");

  // 1. Create database
  try {
    await databases.create(DATABASE_ID, "Filmo DB");
    console.log(`[OK] Database "${DATABASE_ID}" created.`);
  } catch (err) {
    if (isAlreadyExists(err)) {
      console.log(`[SKIP] Database "${DATABASE_ID}" already exists.`);
    } else {
      console.error(`[ERROR] Failed to create database:`, err.message);
      process.exit(1);
    }
  }

  // 2. Create collections & attributes
  const collectionIds = Object.keys(COLLECTIONS);
  console.log(`\nCreating ${collectionIds.length} collections...\n`);

  for (const collectionId of collectionIds) {
    const attrs = COLLECTIONS[collectionId];

    // Document-level security with user read/write on own documents
    const permissions = [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ];

    // Create collection
    try {
      await databases.createCollection(
        DATABASE_ID,
        collectionId,
        collectionId, // name = id for readability
        permissions,
        true // documentSecurity enabled
      );
      console.log(`[OK] Collection "${collectionId}" created.`);
    } catch (err) {
      if (isAlreadyExists(err)) {
        console.log(`[SKIP] Collection "${collectionId}" already exists.`);
      } else {
        console.error(
          `[ERROR] Collection "${collectionId}":`,
          err.message
        );
        continue;
      }
    }

    // Create attributes
    for (const attr of attrs) {
      try {
        const required = false; // all optional for flexibility
        switch (attr.type) {
          case "string":
            await databases.createStringAttribute(
              DATABASE_ID,
              collectionId,
              attr.key,
              attr.size || 255,
              required,
              attr.default ?? null,
              false // array
            );
            break;

          case "email":
            await databases.createEmailAttribute(
              DATABASE_ID,
              collectionId,
              attr.key,
              required,
              attr.default ?? null,
              false
            );
            break;

          case "integer":
            await databases.createIntegerAttribute(
              DATABASE_ID,
              collectionId,
              attr.key,
              required,
              undefined, // min
              undefined, // max
              attr.default ?? null,
              false
            );
            break;

          case "float":
            await databases.createFloatAttribute(
              DATABASE_ID,
              collectionId,
              attr.key,
              required,
              undefined, // min
              undefined, // max
              attr.default ?? null,
              false
            );
            break;

          case "boolean":
            await databases.createBooleanAttribute(
              DATABASE_ID,
              collectionId,
              attr.key,
              required,
              attr.default ?? null,
              false
            );
            break;

          default:
            console.warn(
              `  [WARN] Unknown type "${attr.type}" for ${collectionId}.${attr.key}`
            );
        }
        console.log(`  [OK] ${collectionId}.${attr.key} (${attr.type})`);
      } catch (err) {
        if (isAlreadyExists(err)) {
          console.log(
            `  [SKIP] ${collectionId}.${attr.key} already exists.`
          );
        } else {
          console.error(
            `  [ERROR] ${collectionId}.${attr.key}:`,
            err.message
          );
        }
      }

      // Small delay to avoid rate limits
      await sleep(200);
    }

    console.log("");
  }

  // 3. Create avatars storage bucket
  console.log("Creating storage bucket...\n");
  try {
    await storage.createBucket(
      "avatars",
      "Avatars",
      [
        Permission.read(Role.users()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ],
      true, // fileSecurity
      true, // enabled
      10 * 1024 * 1024, // 10 MB max file size
      ["jpg", "jpeg", "png", "gif", "webp"], // allowed extensions
      "gzip" // compression
    );
    console.log(`[OK] Storage bucket "avatars" created.`);
  } catch (err) {
    if (isAlreadyExists(err)) {
      console.log(`[SKIP] Storage bucket "avatars" already exists.`);
    } else {
      console.error(`[ERROR] Storage bucket "avatars":`, err.message);
    }
  }

  console.log("\n=== Setup complete! ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
