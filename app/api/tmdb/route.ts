import { NextRequest, NextResponse } from 'next/server'

const TMDB_API_KEY = process.env.TMDB_API_KEY!
const TMDB_BASE = 'https://api.themoviedb.org/3'

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
        const type = searchParams.get('type') || 'movie'
        const data = await tmdbFetch(`/${type}/${id}`, {
          append_to_response: 'credits,similar,watch/providers,videos,recommendations',
        })
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
        const data = await tmdbFetch(`/person/${id}`, { append_to_response: 'combined_credits' })
        return NextResponse.json(data)
      }
      case 'genres': {
        const type = searchParams.get('type') || 'movie'
        const data = await tmdbFetch(`/genre/${type}/list`)
        return NextResponse.json(data)
      }
      case 'season': {
        const id = searchParams.get('id')!
        const season = searchParams.get('season_number') || '1'
        const data = await tmdbFetch(`/tv/${id}/season/${season}`)
        return NextResponse.json(data)
      }
      case 'watch_providers': {
        const type = searchParams.get('type') || 'movie'
        const data = await tmdbFetch(`/watch/providers/${type}`, { watch_region: 'JP' })
        return NextResponse.json(data)
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
