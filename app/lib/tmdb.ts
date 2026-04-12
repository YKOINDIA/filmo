const TMDB_API_KEY = process.env.TMDB_API_KEY!
const TMDB_BASE = 'https://api.themoviedb.org/3'

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

interface TMDBOptions {
  language?: string
  region?: string
  page?: number
}

async function tmdbFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  url.searchParams.set('language', params.language || 'ja-JP')
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'language') url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`)
  return res.json()
}

// 映画検索
export async function searchMovies(query: string, opts: TMDBOptions = {}) {
  return tmdbFetch('/search/multi', {
    query,
    page: String(opts.page || 1),
    region: opts.region || 'JP',
  })
}

// 映画詳細
export async function getMovieDetail(id: number, type: 'movie' | 'tv' = 'movie') {
  return tmdbFetch(`/${type}/${id}`, {
    append_to_response: 'credits,similar,watch/providers,videos,recommendations',
  })
}

// トレンド
export async function getTrending(mediaType: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'week') {
  return tmdbFetch(`/trending/${mediaType}/${timeWindow}`)
}

// ディスカバー（絞り込み検索）
export async function discoverMovies(type: 'movie' | 'tv', filters: Record<string, string> = {}) {
  return tmdbFetch(`/discover/${type}`, {
    ...filters,
    'watch_region': 'JP',
  })
}

// 人物詳細
export async function getPersonDetail(id: number) {
  return tmdbFetch(`/person/${id}`, {
    append_to_response: 'combined_credits',
  })
}

// ジャンル一覧
export async function getGenres(type: 'movie' | 'tv' = 'movie') {
  return tmdbFetch(`/genre/${type}/list`)
}

// 日本の配信プロバイダー
export async function getWatchProviders(id: number, type: 'movie' | 'tv' = 'movie') {
  const data = await tmdbFetch(`/${type}/${id}/watch/providers`)
  return data.results?.JP || null
}

// 現在上映中
export async function getNowPlaying(opts: TMDBOptions = {}) {
  return tmdbFetch('/movie/now_playing', {
    region: 'JP',
    page: String(opts.page || 1),
  })
}

// 近日公開
export async function getUpcoming(opts: TMDBOptions = {}) {
  return tmdbFetch('/movie/upcoming', {
    region: 'JP',
    page: String(opts.page || 1),
  })
}

// TV放送中
export async function getOnTheAir(opts: TMDBOptions = {}) {
  return tmdbFetch('/tv/on_the_air', {
    page: String(opts.page || 1),
  })
}

// TVシーズン詳細
export async function getTVSeasonDetail(tvId: number, seasonNumber: number) {
  return tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`)
}
