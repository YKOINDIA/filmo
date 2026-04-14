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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const action = searchParams.get('action')
  // Accept language override from client (e.g. "en-US", "ko-KR")
  const lang = searchParams.get('lang') || undefined

  try {
    switch (action) {
      case 'search': {
        const query = searchParams.get('query') || ''
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/search/multi', { query, page, region: 'JP', ...(lang && { language: lang }) })
        return NextResponse.json(data)
      }
      case 'detail': {
        const id = Number(searchParams.get('id')!)
        const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv'
        // 負のID = ユーザー登録作品、TMDBに問い合わせない
        if (id < 0) {
          const data = await getUserWorkDetail(id)
          if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
          return NextResponse.json(data)
        }
        const data = await getMovieDetailCached(id, type, lang)
        return NextResponse.json(data)
      }
      case 'trending': {
        const mediaType = searchParams.get('media_type') || 'all'
        const data = await tmdbFetch(`/trending/${mediaType}/week`, { ...(lang && { language: lang }) })
        return NextResponse.json(data)
      }
      case 'now_playing': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/movie/now_playing', { region: 'JP', page, ...(lang && { language: lang }) })
        return NextResponse.json(data)
      }
      case 'upcoming': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/movie/upcoming', { region: 'JP', page, ...(lang && { language: lang }) })
        return NextResponse.json(data)
      }
      case 'on_the_air': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/tv/on_the_air', { page, ...(lang && { language: lang }) })
        return NextResponse.json(data)
      }
      case 'discover': {
        const type = searchParams.get('type') || 'movie'
        const params: Record<string, string> = { watch_region: 'JP', ...(lang && { language: lang }) }
        for (const key of ['with_genres', 'sort_by', 'page', 'primary_release_date.gte', 'primary_release_date.lte', 'first_air_date.gte', 'first_air_date.lte', 'vote_count.gte', 'vote_count.lte', 'vote_average.gte', 'with_runtime.gte', 'with_runtime.lte', 'with_watch_providers', 'with_watch_monetization_types', 'with_origin_country', 'with_companies']) {
          const val = searchParams.get(key)
          if (val) params[key] = val
        }
        const data = await tmdbFetch(`/discover/${type}`, params)
        return NextResponse.json(data)
      }
      case 'person': {
        const id = searchParams.get('id')!
        const data = await getPersonDetailCached(Number(id), lang)
        return NextResponse.json(data)
      }
      case 'genres': {
        const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv'
        const data = await getGenresCached(type, lang)
        return NextResponse.json(data)
      }
      case 'season': {
        const id = searchParams.get('id')!
        const season = searchParams.get('season_number') || '1'
        const data = await tmdbFetch(`/tv/${id}/season/${season}`, { ...(lang && { language: lang }) })
        return NextResponse.json(data)
      }
      case 'search_company': {
        const query = searchParams.get('query') || ''
        const data = await tmdbFetch('/search/company', { query })
        return NextResponse.json(data)
      }
      case 'watch_providers': {
        const type = searchParams.get('type') || 'movie'
        const data = await tmdbFetch(`/watch/providers/${type}`, { watch_region: 'JP' })
        return NextResponse.json(data)
      }
      case 'trending_people': {
        const data = await tmdbFetch('/trending/person/week')
        return NextResponse.json(data)
      }
      case 'popular_people': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/person/popular', { page })
        return NextResponse.json(data)
      }
      // Annict連携
      case 'annict_search': {
        const query = searchParams.get('query') || ''
        if (!query.trim()) return NextResponse.json({ results: [] })
        try {
          const results = await searchAnnictCached(query)
          return NextResponse.json({ results: results.map(toTMDBShape) })
        } catch {
          return NextResponse.json({ results: [] })
        }
      }
      case 'annict_season': {
        const year = Number(searchParams.get('year') || new Date().getFullYear())
        const season = (searchParams.get('season') || getCurrentSeason()) as 'spring' | 'summer' | 'autumn' | 'winter'
        try {
          const results = await getSeasonAnimeCached(year, season)
          return NextResponse.json({ results: results.map(toTMDBShape) })
        } catch {
          return NextResponse.json({ results: [] })
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
