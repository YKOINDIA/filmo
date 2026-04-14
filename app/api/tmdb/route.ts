import { NextRequest, NextResponse } from 'next/server'
import {
  getMovieDetailCached,
  getPersonDetailCached,
  getGenresCached,
  tmdbFetch,
} from '@/app/lib/tmdb-cache'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'search': {
        const query = searchParams.get('query') || ''
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/search/multi', { query, page, region: 'JP' })
        return NextResponse.json(data)
      }
      case 'detail': {
        const id = searchParams.get('id')!
        const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv'
        const data = await getMovieDetailCached(Number(id), type)
        return NextResponse.json(data)
      }
      case 'trending': {
        const mediaType = searchParams.get('media_type') || 'all'
        const data = await tmdbFetch(`/trending/${mediaType}/week`)
        return NextResponse.json(data)
      }
      case 'now_playing': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/movie/now_playing', { region: 'JP', page })
        return NextResponse.json(data)
      }
      case 'upcoming': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/movie/upcoming', { region: 'JP', page })
        return NextResponse.json(data)
      }
      case 'on_the_air': {
        const page = searchParams.get('page') || '1'
        const data = await tmdbFetch('/tv/on_the_air', { page })
        return NextResponse.json(data)
      }
      case 'discover': {
        const type = searchParams.get('type') || 'movie'
        const params: Record<string, string> = { watch_region: 'JP' }
        for (const key of ['with_genres', 'sort_by', 'page', 'primary_release_date.gte', 'primary_release_date.lte', 'first_air_date.gte', 'first_air_date.lte', 'vote_count.gte', 'vote_count.lte', 'vote_average.gte', 'with_runtime.gte', 'with_runtime.lte', 'with_watch_providers', 'with_watch_monetization_types', 'with_origin_country', 'with_companies']) {
          const val = searchParams.get(key)
          if (val) params[key] = val
        }
        const data = await tmdbFetch(`/discover/${type}`, params)
        return NextResponse.json(data)
      }
      case 'person': {
        const id = searchParams.get('id')!
        const data = await getPersonDetailCached(Number(id))
        return NextResponse.json(data)
      }
      case 'genres': {
        const type = (searchParams.get('type') || 'movie') as 'movie' | 'tv'
        const data = await getGenresCached(type)
        return NextResponse.json(data)
      }
      case 'season': {
        const id = searchParams.get('id')!
        const season = searchParams.get('season_number') || '1'
        const data = await tmdbFetch(`/tv/${id}/season/${season}`)
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
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
