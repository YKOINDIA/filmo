import { NextRequest, NextResponse } from 'next/server'
import {
  getMovieDetailCached,
  getPersonDetailCached,
  getGenresCached,
  getUserWorkDetail,
  tmdbFetch,
} from '@/app/lib/tmdb-cache'
import { searchAnnictCached, getSeasonAnimeCached } from '@/app/lib/annict-cache'
import type { AnnictWorkNormalized } from '@/app/lib/annict'

// CDN キャッシュヘッダ。/api/tmdb は同じパラメータで何度も呼ばれる典型例なので、
// 同一 URL のレスポンスは Vercel Edge でキャッシュさせて Function Invocation を
// 削減する。検索系は短め、参照系 (詳細・ジャンルなど) は長めに設定。
const CACHE_HEADERS: Record<string, string> = {
  // 5 分キャッシュ + 10 分 SWR。検索キーワードは変動性が高いので短め。
  search:           'public, s-maxage=300, stale-while-revalidate=600',
  search_person:    'public, s-maxage=300, stale-while-revalidate=600',
  search_company:   'public, s-maxage=300, stale-while-revalidate=600',
  annict_search:    'public, s-maxage=300, stale-while-revalidate=600',
  // 30 分キャッシュ + 1h SWR。トレンド/人気/上映中は数十分単位で OK。
  trending:         'public, s-maxage=1800, stale-while-revalidate=3600',
  trending_people:  'public, s-maxage=1800, stale-while-revalidate=3600',
  popular_people:   'public, s-maxage=1800, stale-while-revalidate=3600',
  now_playing:      'public, s-maxage=1800, stale-while-revalidate=3600',
  upcoming:         'public, s-maxage=1800, stale-while-revalidate=3600',
  on_the_air:       'public, s-maxage=1800, stale-while-revalidate=3600',
  // 1 時間キャッシュ + 6h SWR。詳細・ジャンルなどは長期的に安定。
  detail:           'public, s-maxage=3600, stale-while-revalidate=21600',
  person:           'public, s-maxage=3600, stale-while-revalidate=21600',
  season:           'public, s-maxage=3600, stale-while-revalidate=21600',
  genres:           'public, s-maxage=86400, stale-while-revalidate=86400',
  watch_providers:  'public, s-maxage=86400, stale-while-revalidate=86400',
  discover:         'public, s-maxage=600,  stale-while-revalidate=1800',
  annict_season:    'public, s-maxage=3600, stale-while-revalidate=21600',
}

function cacheHeaderFor(action: string | null): string | undefined {
  if (!action) return undefined
  return CACHE_HEADERS[action]
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const action = searchParams.get('action')
  // Accept language override from client (e.g. "en-US", "ko-KR")
  const lang = searchParams.get('lang') || undefined

  const cacheHeader = cacheHeaderFor(action)
  const respond = (body: unknown, init?: ResponseInit) => {
    const res = NextResponse.json(body, init)
    if (cacheHeader && (!init?.status || init.status < 400)) {
      res.headers.set('Cache-Control', cacheHeader)
    }
    return res
  }

  try {
    switch (action) {
      case 'search': {
        const query = searchParams.get('query') || ''
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/search/multi', { query, page, region: 'JP', ...(lang && { language: lang }) })
        return respond(data)
      }
      case 'detail': {
        const id = Number(searchParams.get('id')!)
        const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv'
        // 負のID = ユーザー登録作品、TMDBに問い合わせない
        if (id < 0) {
          const data = await getUserWorkDetail(id)
          if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
          return respond(data)
        }
        const data = await getMovieDetailCached(id, type, lang)
        return respond(data)
      }
      case 'trending': {
        const mediaType = searchParams.get('media_type') || 'all'
        const data = await tmdbFetch(`/trending/${mediaType}/week`, { ...(lang && { language: lang }) })
        return respond(data)
      }
      case 'now_playing': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/movie/now_playing', { region: 'JP', page, ...(lang && { language: lang }) })
        return respond(data)
      }
      case 'upcoming': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/movie/upcoming', { region: 'JP', page, ...(lang && { language: lang }) })
        return respond(data)
      }
      case 'on_the_air': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/tv/on_the_air', { page, ...(lang && { language: lang }) })
        return respond(data)
      }
      case 'discover': {
        const type = searchParams.get('type') || 'movie'
        const params: Record<string, string> = { watch_region: 'JP', ...(lang && { language: lang }) }
        for (const key of ['with_genres', 'sort_by', 'page', 'primary_release_date.gte', 'primary_release_date.lte', 'first_air_date.gte', 'first_air_date.lte', 'vote_count.gte', 'vote_count.lte', 'vote_average.gte', 'with_runtime.gte', 'with_runtime.lte', 'with_watch_providers', 'with_watch_monetization_types', 'with_origin_country', 'with_companies']) {
          const val = searchParams.get(key)
          if (val) params[key] = val
        }
        const data = await tmdbFetch(`/discover/${type}`, params)
        return respond(data)
      }
      case 'person': {
        const id = searchParams.get('id')!
        const data = await getPersonDetailCached(Number(id), lang)
        return respond(data)
      }
      case 'genres': {
        const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv'
        const data = await getGenresCached(type, lang)
        return respond(data)
      }
      case 'season': {
        const id = searchParams.get('id')!
        const season = searchParams.get('season_number') || '1'
        const data = await tmdbFetch(`/tv/${id}/season/${season}`, { ...(lang && { language: lang }) })
        return respond(data)
      }
      case 'search_company': {
        const query = searchParams.get('query') || ''
        const data = await tmdbFetch('/search/company', { query })
        return respond(data)
      }
      case 'watch_providers': {
        const type = searchParams.get('type') || 'movie'
        const data = await tmdbFetch(`/watch/providers/${type}`, { watch_region: 'JP' })
        return respond(data)
      }
      case 'trending_people': {
        const data = await tmdbFetch('/trending/person/week')
        return respond(data)
      }
      case 'popular_people': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/person/popular', { page })
        return respond(data)
      }
      case 'search_person': {
        const query = searchParams.get('query') || ''
        const page = searchParams.get('page') || '1'
        if (!query.trim()) return respond({ results: [] })
        const data = await tmdbFetch('/search/person', { query, page, ...(lang && { language: lang }) })
        return respond(data)
      }
      // Annict連携
      case 'annict_search': {
        const query = searchParams.get('query') || ''
        if (!query.trim()) return respond({ results: [] })
        try {
          const results = await searchAnnictCached(query)
          return respond({ results: results.map(toTMDBShape) })
        } catch {
          return respond({ results: [] })
        }
      }
      case 'annict_season': {
        const year = Number(searchParams.get('year') || new Date().getFullYear())
        const season = (searchParams.get('season') || getCurrentSeason()) as 'spring' | 'summer' | 'autumn' | 'winter'
        try {
          const results = await getSeasonAnimeCached(year, season)
          return respond({ results: results.map(toTMDBShape) })
        } catch {
          return respond({ results: [] })
        }
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** Annict結果をTMDB互換フォーマットに変換 */
function toTMDBShape(w: AnnictWorkNormalized) {
  return {
    id: w.annict_id, // フロントではannict_idをそのまま使う（正のID）
    name: w.title,
    title: w.title,
    poster_path: w.poster_path,
    backdrop_path: null,
    media_type: 'tv',
    release_date: w.release_date,
    first_air_date: w.release_date,
    vote_average: w.vote_average,
    overview: '',
    genre_ids: [16], // アニメ
    _annict: true, // Annict由来フラグ
    _annict_id: w.annict_id,
  }
}

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1
  if (month >= 1 && month <= 3) return 'winter'
  if (month >= 4 && month <= 6) return 'spring'
  if (month >= 7 && month <= 9) return 'summer'
  return 'autumn'
}
