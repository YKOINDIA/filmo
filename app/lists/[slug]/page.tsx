import type { Metadata } from 'next'

const TMDB_IMG = 'https://image.tmdb.org/t/p'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ListMovie {
  tmdb_id: number
  title: string
  poster_path: string | null
  release_date: string | null
  vote_average: number | null
}

interface ListItem {
  id: string
  movie_id: number
  position: number
  note: string | null
  movie: ListMovie | null
}

interface ListData {
  id: string
  title: string
  description: string
  is_public: boolean
  is_ranked: boolean
  items_count: number
  likes_count: number
  user_id: string
  slug: string | null
  user_name: string
  user_avatar: string | null
}

async function fetchListData(slug: string): Promise<{ list: ListData; items: ListItem[] } | null> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Try slug first, then id
    let { data: list } = await admin.from('user_lists').select('*').eq('slug', slug).single()
    if (!list) {
      const { data: listById } = await admin.from('user_lists').select('*').eq('id', slug).single()
      list = listById
    }

    if (!list || !list.is_public) return null

    const { data: items } = await admin
      .from('list_items')
      .select('id, movie_id, position, note')
      .eq('list_id', list.id)
      .order('position', { ascending: true })

    let enrichedItems: ListItem[] = (items || []).map(i => ({ ...i, movie: null }))

    if (enrichedItems.length > 0) {
      const movieIds = [...new Set(enrichedItems.map(i => i.movie_id))]
      const { data: movies } = await admin
        .from('movies')
        .select('tmdb_id, title, poster_path, release_date, vote_average')
        .in('tmdb_id', movieIds)

      const movieMap = new Map<number, ListMovie>()
      if (movies) {
        for (const m of movies as unknown as ListMovie[]) {
          movieMap.set(m.tmdb_id, m)
        }
      }
      enrichedItems = enrichedItems.map(item => ({
        ...item,
        movie: movieMap.get(item.movie_id) || null,
      }))
    }

    const { data: user } = await admin.from('users').select('name, avatar_url').eq('id', list.user_id).single()

    return {
      list: { ...list, user_name: user?.name || 'Unknown', user_avatar: user?.avatar_url || null },
      items: enrichedItems,
    }
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = await fetchListData(slug)

  if (!data) {
    return { title: 'List Not Found' }
  }

  const { list } = data
  return {
    title: `${list.title} — ${list.user_name}`,
    description: list.description || `A list of ${list.items_count} films curated by ${list.user_name} on Filmo.`,
    openGraph: {
      type: 'article',
      title: `${list.title} — ${list.user_name}`,
      description: list.description || `${list.items_count} films`,
      url: `${APP_URL}/lists/${slug}`,
      siteName: 'Filmo',
    },
    twitter: {
      card: 'summary',
      title: `${list.title} — ${list.user_name}`,
      description: list.description || `${list.items_count} films`,
    },
  }
}

export default async function PublicListPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await fetchListData(slug)

  if (!data) {
    return (
      <div style={{
        minHeight: '100dvh', background: 'var(--fm-bg)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 8 }}>List not found</h1>
          <p style={{ color: 'var(--fm-text-sub)', fontSize: 14 }}>This list may be private or doesn't exist.</p>
          <a href="/" style={{ color: 'var(--fm-accent)', fontSize: 14, textDecoration: 'none', marginTop: 16, display: 'inline-block' }}>
            Go to Filmo
          </a>
        </div>
      </div>
    )
  }

  const { list, items } = data

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--fm-bg)', color: 'var(--fm-text)',
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--fm-border)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1.5, color: 'var(--fm-text)', textTransform: 'uppercase' as const }}>
            Filmo
          </span>
        </a>
        <a href="/" style={{
          padding: '6px 16px', borderRadius: 6, border: 'none',
          background: 'var(--fm-accent)', color: '#fff', fontSize: 12, fontWeight: 600,
          textDecoration: 'none',
        }}>
          Sign Up Free
        </a>
      </header>

      {/* List content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 60px' }}>
        {/* Author */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {list.user_avatar ? (
            <img src={list.user_avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fm-bg-secondary)' }} />
          )}
          <span style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>
            List by <strong style={{ color: 'var(--fm-text)' }}>{list.user_name}</strong>
          </span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 8px', lineHeight: 1.3 }}>
          {list.title}
        </h1>
        {list.description && (
          <p style={{ fontSize: 15, color: 'var(--fm-text-sub)', margin: '0 0 16px', lineHeight: 1.6 }}>
            {list.description}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, fontSize: 13, color: 'var(--fm-text-muted)' }}>
          <span>{list.items_count} films</span>
          {list.likes_count > 0 && <span>{list.likes_count} likes</span>}
          {list.is_ranked && <span style={{ color: 'var(--fm-accent)' }}>Ranked</span>}
        </div>

        <hr style={{ border: 'none', height: 1, background: 'var(--fm-border)', margin: '0 0 24px' }} />

        {/* Films */}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--fm-text-muted)' }}>
            This list is empty.
          </div>
        ) : list.is_ranked ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {items.map((item, idx) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '10px 4px',
                borderBottom: '1px solid var(--fm-border)',
              }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--fm-text-muted)', width: 32, textAlign: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </span>
                {item.movie?.poster_path ? (
                  <img src={`${TMDB_IMG}/w154${item.movie.poster_path}`} alt=""
                    style={{ width: 48, height: 72, borderRadius: 4, objectFit: 'cover', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                ) : (
                  <div style={{ width: 48, height: 72, borderRadius: 4, background: 'var(--fm-bg-secondary)', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fm-text)' }}>
                    {item.movie?.title || `Movie #${item.movie_id}`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    {item.movie?.release_date && (
                      <span style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>{item.movie.release_date.slice(0, 4)}</span>
                    )}
                    {item.movie?.vote_average != null && item.movie.vote_average > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--fm-star)' }}>
                        ★ {(item.movie.vote_average / 2).toFixed(1)}
                      </span>
                    )}
                  </div>
                  {item.note && (
                    <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginTop: 4, lineHeight: 1.4 }}>
                      {item.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: 8,
          }}>
            {items.map(item => (
              <div key={item.id} className="poster-item" style={{ cursor: 'default' }}>
                {item.movie?.poster_path ? (
                  <img
                    src={`${TMDB_IMG}/w300${item.movie.poster_path}`}
                    alt={item.movie?.title || ''}
                    loading="lazy"
                  />
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: '2/3',
                    background: 'var(--fm-bg-secondary)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--fm-text-muted)', fontSize: 10,
                  }}>
                    {item.movie?.title || 'No Image'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{
          marginTop: 40, padding: 24, borderRadius: 10,
          background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
          textAlign: 'center',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 8px' }}>
            Create your own lists on Filmo
          </h3>
          <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: '0 0 16px' }}>
            Track films, write reviews, and share your favorites.
          </p>
          <a href="/" style={{
            display: 'inline-block', padding: '10px 28px', borderRadius: 8,
            background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 600,
            textDecoration: 'none',
          }}>
            Get Started — It's Free
          </a>
        </div>
      </div>
    </div>
  )
}
