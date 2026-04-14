/**
 * TMDB API Cache Layer
 * Supabase DBをキャッシュとして利用し、TMDB APIへのリクエストを大幅に削減する。
 * キャッシュミス時のみTMDBに問い合わせ、結果をDBに保存する。
 */
import { getSupabaseAdmin } from './supabase-admin'

const TMDB_API_KEY = process.env.TMDB_API_KEY!
const TMDB_BASE = 'https://api.themoviedb.org/3'

// キャッシュ有効期間（時間単位）
const CACHE_TTL = {
  detail: 24,        // 映画・TV詳細: 24時間
  person: 48,        // 人物詳細: 48時間
  genres: 168,       // ジャンル: 7日
  trending: 1,       // トレンド: 1時間（ISRに委ねる）
  list: 6,           // now_playing, upcoming, on_the_air: 6時間
} as const

function isWithinHours(cachedAt: string, hours: number): boolean {
  const cached = new Date(cachedAt).getTime()
  const now = Date.now()
  return (now - cached) < hours * 60 * 60 * 1000
}

// --- Raw TMDB fetch (キャッシュなし) ---

async function tmdbFetchRaw(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  // Allow language override; fallback to ja-JP
  url.searchParams.set('language', params.language || 'ja-JP')
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'language') url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`)
  return res.json()
}

// --- 映画・TV詳細キャッシュ ---

export async function getMovieDetailCached(id: number, type: 'movie' | 'tv' = 'movie', language?: string) {
  // Non-default language: fetch directly from TMDB (no DB cache for translated data)
  if (language && language !== 'ja-JP') {
    return tmdbFetchRaw(`/${type}/${id}`, {
      language,
      append_to_response: 'credits,similar,watch/providers,videos,recommendations',
    })
  }

  const supabase = getSupabaseAdmin()

  // 1. キャッシュ確認
  const { data: cached } = await supabase
    .from('movies')
    .select('*')
    .eq('tmdb_id', id)
    .eq('media_type', type === 'tv' ? 'tv' : 'movie')
    .single()

  if (cached?.cached_at && isWithinHours(cached.cached_at, CACHE_TTL.detail) && cached.credits && Object.keys(cached.credits as object).length > 0) {
    // キャッシュにfull_responseがあればそれを返す、なければTMDBから再取得
    if (cached.full_response) return cached.full_response
  }

  // 2. TMDBから取得
  const fresh = await tmdbFetchRaw(`/${type}/${id}`, {
    append_to_response: 'credits,similar,watch/providers,videos,recommendations',
  })

  // 3. DBに保存（upsert）
  const mediaType = type === 'tv' ? 'tv' : 'movie'
  await supabase.from('movies').upsert({
    id: fresh.id,
    tmdb_id: fresh.id,
    title: fresh.title || fresh.name || '',
    original_title: fresh.original_title || fresh.original_name || '',
    overview: fresh.overview || '',
    poster_path: fresh.poster_path,
    backdrop_path: fresh.backdrop_path,
    release_date: fresh.release_date || fresh.first_air_date || null,
    runtime: fresh.runtime || fresh.episode_run_time?.[0] || null,
    vote_average: fresh.vote_average,
    vote_count: fresh.vote_count,
    genres: fresh.genres || [],
    production_countries: fresh.production_countries || [],
    credits: fresh.credits || {},
    media_type: mediaType,
    number_of_seasons: fresh.number_of_seasons || null,
    number_of_episodes: fresh.number_of_episodes || null,
    status: fresh.status || null,
    full_response: fresh,
    data_source: 'tmdb',
    is_verified: true,
    cached_at: new Date().toISOString(),
  }, { onConflict: 'tmdb_id' })

  return fresh
}

/**
 * ユーザー登録作品・Annict作品の詳細取得（TMDBにfallbackしない）
 */
export async function getUserWorkDetail(movieId: number) {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('movies')
    .select('*')
    .eq('id', movieId)
    .single()
  return data
}

// --- 人物詳細キャッシュ ---

export async function getPersonDetailCached(id: number, language?: string) {
  // Non-default language: fetch directly from TMDB
  if (language && language !== 'ja-JP') {
    return tmdbFetchRaw(`/person/${id}`, {
      language,
      append_to_response: 'combined_credits',
    })
  }

  const supabase = getSupabaseAdmin()

  // 1. キャッシュ確認（actors → directors の順で探す）
  const { data: cachedActor } = await supabase
    .from('persons')
    .select('*')
    .eq('tmdb_id', id)
    .single()

  if (cachedActor?.cached_at && isWithinHours(cachedActor.cached_at, CACHE_TTL.person) && cachedActor.full_response) {
    return cachedActor.full_response
  }

  // 2. TMDBから取得
  const fresh = await tmdbFetchRaw(`/person/${id}`, {
    append_to_response: 'combined_credits',
  })

  // 3. personsテーブルにupsert
  await supabase.from('persons').upsert({
    id: fresh.id,
    tmdb_id: fresh.id,
    name: fresh.name || '',
    profile_path: fresh.profile_path,
    biography: fresh.biography || '',
    birthday: fresh.birthday || null,
    place_of_birth: fresh.place_of_birth || null,
    known_for: fresh.known_for_department ? [fresh.known_for_department] : [],
    full_response: fresh,
    cached_at: new Date().toISOString(),
  }, { onConflict: 'tmdb_id' })

  return fresh
}

// --- ジャンル一覧キャッシュ（サーバーメモリ + DB） ---

const genresMemoryCache: Record<string, { data: unknown; fetchedAt: number }> = {}

export async function getGenresCached(type: 'movie' | 'tv' = 'movie', language?: string) {
  const lang = language || 'ja-JP'
  const cacheKey = `genres_${type}_${lang}`

  // インメモリキャッシュ確認（最速）
  const mem = genresMemoryCache[cacheKey]
  if (mem && (Date.now() - mem.fetchedAt) < CACHE_TTL.genres * 60 * 60 * 1000) {
    return mem.data
  }

  // TMDBから取得（ジャンルは軽量なのでDB不要、メモリキャッシュのみ）
  const fresh = await tmdbFetchRaw(`/genre/${type}/list`, { language: lang })
  genresMemoryCache[cacheKey] = { data: fresh, fetchedAt: Date.now() }
  return fresh
}

// --- キャッシュなし（リスト系・検索系はISRに委ねる） ---

export { tmdbFetchRaw as tmdbFetch }
