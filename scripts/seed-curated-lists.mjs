#!/usr/bin/env node
/**
 * Filmo編集部のキュレーションリストを Supabase にシード/更新する。
 *
 * 必要な環境変数 (.env.local 等):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - TMDB_API_KEY (or TMDB_BEARER_TOKEN)
 *
 * 使い方:
 *   node scripts/seed-curated-lists.mjs
 *   node scripts/seed-curated-lists.mjs --only=studio-ghibli,oscar-winners  # 一部だけ
 *   node scripts/seed-curated-lists.mjs --dry-run                           # 確認のみ
 *
 * 動作:
 *   - manifest の各リストについて user_lists を upsert (slug 一意)
 *   - selection.type === 'discover' なら TMDB API を叩いて movie_id 配列を取得
 *   - selection.type === 'static' なら movieIds をそのまま使用
 *   - movies テーブルに poster/title/release_date 等を upsert (TMDB から取得)
 *   - list_items を一旦削除して再挿入
 *   - is_curated = TRUE / user_id = SYSTEM_USER_ID で固定
 *
 * Idempotent — 何度回しても OK (slug が一致するリストは更新)。
 */

import { createClient } from '@supabase/supabase-js'
import { CURATED_LISTS } from './curated-lists-manifest.mjs'

// ── env load ──
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = resolve(__dirname, '..', '.env.local')
if (existsSync(ENV_PATH)) {
  for (const line of readFileSync(ENV_PATH, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      process.env[m[1]] = v
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TMDB_KEY = process.env.TMDB_API_KEY
const TMDB_BEARER = process.env.TMDB_BEARER_TOKEN

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です')
  process.exit(1)
}
if (!TMDB_KEY && !TMDB_BEARER) {
  console.error('❌ TMDB_API_KEY または TMDB_BEARER_TOKEN が必要です')
  process.exit(1)
}

const args = process.argv.slice(2)
const onlyArg = args.find(a => a.startsWith('--only='))
const onlySlugs = onlyArg ? onlyArg.slice('--only='.length).split(',') : null
const dryRun = args.includes('--dry-run')

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'
const TMDB_BASE = 'https://api.themoviedb.org/3'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── TMDB helpers ──
async function tmdbFetch(path) {
  const url = new URL(`${TMDB_BASE}${path}`)
  if (!TMDB_BEARER && TMDB_KEY) url.searchParams.set('api_key', TMDB_KEY)
  url.searchParams.set('language', 'ja-JP')
  const res = await fetch(url.toString(), {
    headers: TMDB_BEARER ? { Authorization: `Bearer ${TMDB_BEARER}` } : {},
  })
  if (!res.ok) throw new Error(`TMDB ${res.status} ${path}`)
  return res.json()
}

async function discoverMovies(params, limit) {
  const url = new URL(`${TMDB_BASE}/discover/movie`)
  if (!TMDB_BEARER && TMDB_KEY) url.searchParams.set('api_key', TMDB_KEY)
  url.searchParams.set('language', 'ja-JP')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }

  const collected = []
  let page = 1
  while (collected.length < limit && page <= 5) {
    url.searchParams.set('page', String(page))
    const res = await fetch(url.toString(), {
      headers: TMDB_BEARER ? { Authorization: `Bearer ${TMDB_BEARER}` } : {},
    })
    if (!res.ok) {
      console.warn(`  ⚠️  TMDB discover page=${page} status=${res.status}`)
      break
    }
    const data = await res.json()
    const results = data.results || []
    if (results.length === 0) break
    collected.push(...results)
    if (page >= (data.total_pages || 1)) break
    page++
  }
  return collected.slice(0, limit)
}

async function getMovieDetails(tmdbId) {
  try {
    return await tmdbFetch(`/movie/${tmdbId}`)
  } catch (err) {
    console.warn(`  ⚠️  Could not fetch movie ${tmdbId}: ${err.message}`)
    return null
  }
}

// ── Supabase helpers ──
async function upsertList(list) {
  const payload = {
    user_id: SYSTEM_USER_ID,
    title: list.title,
    description: list.description,
    is_public: true,
    is_ranked: false,
    is_curated: true,
    slug: list.slug,
  }
  const { data, error } = await supabase
    .from('user_lists')
    .upsert(payload, { onConflict: 'slug' })
    .select('id')
    .single()
  if (error) throw new Error(`upsert list ${list.slug}: ${error.message}`)
  return data.id
}

async function upsertMovies(movies) {
  if (movies.length === 0) return
  const rows = movies.map(m => ({
    id: String(m.id),
    tmdb_id: m.id,
    title: m.title || m.name || `Movie ${m.id}`,
    poster_path: m.poster_path || null,
    release_date: m.release_date || null,
    vote_average: m.vote_average ?? 0,
    media_type: 'movie',
    genres: (m.genres || (m.genre_ids || []).map(id => ({ id }))) ,
  }))
  // チャンク分けしてupsert (大量だと TOAST/payload で詰まる)
  for (let i = 0; i < rows.length; i += 50) {
    const slice = rows.slice(i, i + 50)
    const { error } = await supabase.from('movies').upsert(slice, { onConflict: 'tmdb_id' })
    if (error) throw new Error(`upsert movies (batch ${i}): ${error.message}`)
  }
}

async function replaceListItems(listId, movieIds) {
  const { error: delErr } = await supabase.from('list_items').delete().eq('list_id', listId)
  if (delErr) throw new Error(`delete list_items: ${delErr.message}`)
  if (movieIds.length === 0) return

  const rows = movieIds.map((id, idx) => ({
    list_id: listId,
    movie_id: id,
    position: idx,
    note: null,
  }))
  for (let i = 0; i < rows.length; i += 50) {
    const slice = rows.slice(i, i + 50)
    const { error } = await supabase.from('list_items').upsert(slice, { onConflict: 'list_id,movie_id' })
    if (error) throw new Error(`insert list_items (batch ${i}): ${error.message}`)
  }
}

async function refreshListMeta(listId, itemsCount) {
  const { error } = await supabase.from('user_lists').update({
    items_count: itemsCount,
    updated_at: new Date().toISOString(),
  }).eq('id', listId)
  if (error) console.warn(`  ⚠️  could not refresh meta: ${error.message}`)
}

// ── main ──
async function processList(list) {
  const tag = `[${list.slug}]`
  console.log(`${tag} ${list.title}`)

  // 1) movie_ids 決定
  let movies = []
  if (list.selection.type === 'discover') {
    movies = await discoverMovies(list.selection.params, list.limit || 25)
    console.log(`${tag}   discover → ${movies.length} 件`)
  } else if (list.selection.type === 'static') {
    // dedupe & verify by fetching details
    const unique = [...new Set(list.selection.movieIds)]
    for (const id of unique) {
      const detail = await getMovieDetails(id)
      if (detail && detail.id) movies.push(detail)
    }
    console.log(`${tag}   static → ${movies.length}/${unique.length} 件`)
  } else {
    console.warn(`${tag}   ⚠️  unknown selection type`)
    return
  }

  if (movies.length === 0) {
    console.warn(`${tag}   ⚠️  0 件、スキップ`)
    return
  }

  if (dryRun) {
    console.log(`${tag}   (dry-run) ${movies.length} 件で作成予定`)
    return
  }

  // 2) movies テーブル更新
  await upsertMovies(movies)

  // 3) list 本体 upsert
  const listId = await upsertList(list)

  // 4) list_items 入れ替え
  await replaceListItems(listId, movies.map(m => m.id))

  // 5) items_count 更新
  await refreshListMeta(listId, movies.length)

  console.log(`${tag}   ✅ done (${movies.length} 件)`)
}

async function main() {
  const lists = onlySlugs
    ? CURATED_LISTS.filter(l => onlySlugs.includes(l.slug))
    : CURATED_LISTS
  console.log(`▶ ${lists.length} リストを処理 ${dryRun ? '(dry-run)' : ''}`)

  let success = 0
  let failed = 0
  for (const list of lists) {
    try {
      await processList(list)
      success++
    } catch (err) {
      console.error(`[${list.slug}] ❌ ${err.message}`)
      failed++
    }
  }
  console.log(`\n✅ 完了: ${success} success / ${failed} failed / ${lists.length} total`)
}

main().catch(err => {
  console.error('fatal:', err)
  process.exit(1)
})
