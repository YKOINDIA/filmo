import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const slug = searchParams.get('slug')
  const id = searchParams.get('id')

  if (!slug && !id) {
    return Response.json({ error: 'Missing slug or id' }, { status: 400 })
  }

  const admin = getAdmin()

  try {
    // Fetch list
    let query = admin.from('user_lists').select('*')
    if (slug) {
      query = query.eq('slug', slug)
    } else {
      query = query.eq('id', id)
    }
    const { data: list, error: listError } = await query.single()

    if (listError || !list) {
      return Response.json({ error: 'List not found' }, { status: 404 })
    }

    // Only show public lists to unauthenticated requests
    if (!list.is_public) {
      return Response.json({ error: 'This list is private' }, { status: 403 })
    }

    // Fetch items with movie data
    const { data: items } = await admin
      .from('list_items')
      .select('id, movie_id, position, note')
      .eq('list_id', list.id)
      .order('position', { ascending: true })

    const rawItems = items || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let enrichedItems: any[] = rawItems

    if (rawItems.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const movieIds = [...new Set(rawItems.map((i: any) => i.movie_id as number))]
      const { data: movies } = await admin
        .from('movies')
        .select('tmdb_id, title, poster_path, release_date, vote_average')
        .in('tmdb_id', movieIds)

      const movieMap = new Map()
      if (movies) {
        for (const m of movies) {
          movieMap.set(m.tmdb_id, m)
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enrichedItems = rawItems.map((item: any) => ({
        ...item,
        movie: movieMap.get(item.movie_id) || null,
      }))
    }

    // Fetch user info
    const { data: user } = await admin
      .from('users')
      .select('name, avatar_url')
      .eq('id', list.user_id)
      .single()

    return Response.json({
      list: {
        ...list,
        user_name: user?.name,
        user_avatar: user?.avatar_url,
      },
      items: enrichedItems,
    })
  } catch (err) {
    console.error('List API error:', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
