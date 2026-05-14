#!/usr/bin/env node
/**
 * 絵文字タイトル当てミニゲームの出題プールを Supabase にシード/補充する。
 *
 * TMDB の人気作品 (movie + tv) を順に走査し、Gemini で
 * 「ネタバレなしの絵文字3〜5個」を生成して emoji_quizzes に upsert する。
 *
 * 必要な環境変数 (.env.local 等):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - TMDB_API_KEY (or TMDB_BEARER_TOKEN)
 *   - GEMINI_API_KEY (https://aistudio.google.com/apikey で無料発行)
 *
 * 使い方:
 *   node scripts/seed-emoji-quizzes.mjs                    # 初回 500 件
 *   node scripts/seed-emoji-quizzes.mjs --limit=100        # 件数を指定
 *   node scripts/seed-emoji-quizzes.mjs --type=tv          # tv のみ
 *   node scripts/seed-emoji-quizzes.mjs --dry-run          # 生成せず TMDB 取得のみ
 *   node scripts/seed-emoji-quizzes.mjs --force-regen      # 既存も再生成
 *
 * 無料枠 (gemini-2.0-flash):
 *   15 RPM / 1500 RPD なので、5件バッチ + 4.5秒間隔で 500件 ≒ 8分。
 *
 * Idempotent — 既存の (tmdb_id, media_type) はデフォルトでスキップする。
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI, Type } from '@google/genai'

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── env load ──
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
const GEMINI_KEY = process.env.GEMINI_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です')
  process.exit(1)
}
if (!TMDB_KEY && !TMDB_BEARER) {
  console.error('❌ TMDB_API_KEY または TMDB_BEARER_TOKEN が必要です')
  process.exit(1)
}
if (!GEMINI_KEY) {
  console.error('❌ GEMINI_API_KEY が必要です (https://aistudio.google.com/apikey で無料発行)')
  process.exit(1)
}

const args = process.argv.slice(2)
const limit = Number((args.find(a => a.startsWith('--limit=')) || '--limit=500').split('=')[1])
const typeArg = (args.find(a => a.startsWith('--type=')) || '--type=both').split('=')[1]
const dryRun = args.includes('--dry-run')
const forceRegen = args.includes('--force-regen')

const TMDB_BASE = 'https://api.themoviedb.org/3'
const MODEL = 'gemini-2.5-flash'
const BATCH_SIZE = 5      // 1リクエスト当たりの作品数
const BATCH_DELAY_MS = 4500 // 無料枠 15 RPM (=4秒/req) を安全側に
const MAX_RETRIES = 2

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY })

// ── TMDB helpers ──
async function tmdbFetch(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`)
  if (!TMDB_BEARER && TMDB_KEY) url.searchParams.set('api_key', TMDB_KEY)
  url.searchParams.set('language', 'ja-JP')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    headers: TMDB_BEARER ? { Authorization: `Bearer ${TMDB_BEARER}` } : {},
  })
  if (!res.ok) throw new Error(`TMDB ${res.status} ${path}`)
  return res.json()
}

async function fetchPopular(mediaType, count) {
  const collected = []
  const seen = new Set()
  let page = 1
  while (collected.length < count && page <= 25) {
    const data = await tmdbFetch(`/${mediaType}/popular`, { page })
    for (const item of data.results || []) {
      if (!item.id || seen.has(item.id)) continue
      const title = item.title || item.name
      if (!title || !item.overview) continue
      seen.add(item.id)
      collected.push({
        tmdb_id: item.id,
        media_type: mediaType,
        title,
        overview: item.overview,
        poster_path: item.poster_path || null,
        release_year: parseInt(((item.release_date || item.first_air_date) || '0000').slice(0, 4), 10) || null,
        genre_ids: item.genre_ids || [],
        popularity: item.popularity || 0,
      })
      if (collected.length >= count) break
    }
    page++
  }
  return collected
}

let GENRE_MAP_CACHE = null
async function loadGenreMap() {
  if (GENRE_MAP_CACHE) return GENRE_MAP_CACHE
  const [movie, tv] = await Promise.all([
    tmdbFetch('/genre/movie/list'),
    tmdbFetch('/genre/tv/list'),
  ])
  const map = new Map()
  for (const g of [...(movie.genres || []), ...(tv.genres || [])]) {
    map.set(g.id, g.name)
  }
  GENRE_MAP_CACHE = map
  return map
}

// ── LLM ──
const SYSTEM_INSTRUCTION = `あなたは映画・ドラマの題材から、ネタバレを避けた「絵文字ヒント」を作る専門家です。

入力された作品リストの各作品に対し、以下のルールで絵文字を選んでください:
- 絵文字は3〜5個。多すぎず少なすぎず。
- 作品の象徴・舞台・モチーフ・雰囲気を表す。タイトル文字の連想ではない。
- 致命的なネタバレ(犯人/結末/重要キャラの死)は避ける。
- 一般的に通用するUnicode絵文字のみ使う(国旗や合字は控えめに)。
- 難易度は1(かなり易しい)〜5(マニアック)で自己評価する。

入力された全作品について、tmdb_id をキーにして絵文字と難易度を返してください。`

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      tmdb_id: { type: Type.INTEGER },
      emojis: { type: Type.ARRAY, items: { type: Type.STRING } },
      difficulty: { type: Type.INTEGER },
    },
    required: ['tmdb_id', 'emojis', 'difficulty'],
  },
}

async function generateBatch(works) {
  const userMsg = works.map(w =>
    `- tmdb_id=${w.tmdb_id} / タイトル「${w.title}」(${w.release_year || '?'}年)\n  あらすじ: ${w.overview.slice(0, 250)}`
  ).join('\n\n')

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: MODEL,
        contents: userMsg,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.7,
        },
      })
      const text = resp.text
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('not an array')
      return parsed
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err
      const wait = 5000 * (attempt + 1)
      console.warn(`  ⚠️  retry ${attempt + 1}/${MAX_RETRIES} after ${wait}ms: ${err.message}`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  return []
}

// ── main ──
async function main() {
  console.log(`🎮 絵文字クイズシード開始: limit=${limit} type=${typeArg} dryRun=${dryRun} forceRegen=${forceRegen}`)
  console.log(`   model=${MODEL} batch=${BATCH_SIZE} delay=${BATCH_DELAY_MS}ms`)

  const types = typeArg === 'both' ? ['movie', 'tv'] : [typeArg]
  const perType = Math.ceil(limit / types.length)

  const genreMap = await loadGenreMap()

  let existingKeys = new Set()
  if (!forceRegen) {
    const { data, error } = await supabase
      .from('emoji_quizzes')
      .select('tmdb_id, media_type')
      .limit(10000)
    if (error) throw new Error(`load existing: ${error.message}`)
    existingKeys = new Set((data || []).map(r => `${r.media_type}:${r.tmdb_id}`))
    console.log(`📦 既存 ${existingKeys.size} 件はスキップ`)
  }

  const candidates = []
  for (const mt of types) {
    console.log(`\n📡 TMDB popular/${mt} 取得中...`)
    const fetched = await fetchPopular(mt, perType * 2)
    for (const w of fetched) {
      const key = `${w.media_type}:${w.tmdb_id}`
      if (existingKeys.has(key)) continue
      candidates.push(w)
      if (candidates.length >= limit) break
    }
    if (candidates.length >= limit) break
  }

  console.log(`\n🎯 対象 ${candidates.length} 件を ${Math.ceil(candidates.length / BATCH_SIZE)} バッチで生成`)

  if (dryRun) {
    console.log('--- dry-run 終了 ---')
    candidates.slice(0, 10).forEach(c => console.log(`  ${c.media_type} ${c.tmdb_id} ${c.title}`))
    return
  }

  let ok = 0, fail = 0
  const tmdbIdToWork = new Map(candidates.map(w => [w.tmdb_id, w]))

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    const batchNo = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(candidates.length / BATCH_SIZE)
    try {
      const results = await generateBatch(batch)

      const rows = []
      for (const r of results) {
        const w = tmdbIdToWork.get(r.tmdb_id)
        if (!w) {
          console.warn(`  ⚠️  unknown tmdb_id=${r.tmdb_id} (LLM hallucination)`)
          continue
        }
        if (!Array.isArray(r.emojis) || r.emojis.length < 2 || r.emojis.length > 8) {
          console.warn(`  ⚠️  ${w.title}: invalid emojis ${JSON.stringify(r.emojis)}`)
          fail++
          continue
        }
        const genres = (w.genre_ids || []).map(id => genreMap.get(id)).filter(Boolean)
        rows.push({
          tmdb_id: w.tmdb_id,
          media_type: w.media_type,
          title: w.title,
          emojis: r.emojis.map(String),
          difficulty: Math.max(1, Math.min(5, parseInt(r.difficulty, 10) || 3)),
          poster_path: w.poster_path,
          release_year: w.release_year,
          genres,
          generated_by: MODEL,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from('emoji_quizzes')
          .upsert(rows, { onConflict: 'tmdb_id,media_type' })
        if (error) throw error
        ok += rows.length
      }

      const pct = Math.round(((i + batch.length) / candidates.length) * 100)
      console.log(`  [${pct}%] batch ${batchNo}/${totalBatches} ✅ ${rows.length}/${batch.length} 件成功`)
      rows.forEach(r => console.log(`     ${r.title} ${r.emojis.join(' ')} (Lv.${r.difficulty})`))
    } catch (err) {
      fail += batch.length
      console.warn(`  ❌ batch ${batchNo} failed: ${err.message}`)
    }

    // Rate limit: 15 RPM
    if (i + BATCH_SIZE < candidates.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }
  }

  console.log(`\n🏁 完了: 成功 ${ok} / 失敗 ${fail}`)
}

main().catch(err => {
  console.error('💥 fatal:', err)
  process.exit(1)
})
