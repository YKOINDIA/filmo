import type { Metadata } from 'next'
import Link from 'next/link'
import PersonSearch from '../components/PersonSearch'
import PersonListFilter from '../components/PersonListFilter'

const TMDB_IMG = 'https://image.tmdb.org/t/p'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const metadata: Metadata = {
  title: '俳優一覧 — Filmo',
  description: 'Filmoに登録された映画から、俳優を出演本数順に一覧表示。お気に入りの俳優の作品をまとめて発見しよう。',
  openGraph: {
    type: 'website',
    title: '俳優一覧 — Filmo',
    description: 'Filmoに登録された映画から、俳優を出演本数順に一覧表示',
    url: `${APP_URL}/actors`,
    siteName: 'Filmo',
  },
}

interface ActorRow {
  person_id: number
  name: string
  profile_path: string | null
  film_count: number
}

async function fetchActors(country: string | null, movieQuery: string | null): Promise<ActorRow[]> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data, error } = await admin.rpc('get_filmo_actors', {
      p_limit: 200,
      p_offset: 0,
      p_country: country,
      p_movie_query: movieQuery,
    })
    if (error) {
      console.error('get_filmo_actors RPC failed:', error)
      return []
    }
    return (data || []) as ActorRow[]
  } catch (e) {
    console.error('fetchActors failed:', e)
    return []
  }
}

export default async function ActorsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; movie?: string }>
}) {
  const sp = await searchParams
  const country = sp.country?.trim() || null
  const movieQuery = sp.movie?.trim() || null
  const hasFilter = !!country || !!movieQuery

  const actors = await fetchActors(country, movieQuery)

  return (
    <main style={{
      maxWidth: 1100, margin: '0 auto', padding: '24px 16px 80px',
      color: 'var(--fm-text)',
    }}>
      <Link href="/" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--fm-accent)', textDecoration: 'none',
        fontSize: 14, marginBottom: 16,
      }}>
        ← Filmoに戻る
      </Link>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>俳優一覧</h1>
        <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: 0, lineHeight: 1.6 }}>
          Filmoに登録されている映画から俳優を集計しています。<br />
          一覧に名前がない場合は下の検索ボックスでTMDB全体から探せます。
        </p>
      </header>

      <PersonSearch placeholder="俳優名で検索（TMDB全体から）" />

      <PersonListFilter
        initialCountry={country || ''}
        initialMovie={movieQuery || ''}
        moviePlaceholder="🎬 出演映画タイトルで絞り込み"
      />

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
          {hasFilter ? '絞り込み結果' : '出演本数の多い俳優'}{' '}
          <span style={{ color: 'var(--fm-text-muted)', fontWeight: 500, fontSize: 13 }}>（{actors.length}名）</span>
        </h2>

        {actors.length === 0 ? (
          <p style={{ color: 'var(--fm-text-muted)', fontSize: 14, padding: 24, textAlign: 'center' }}>
            {hasFilter
              ? '条件に一致する俳優が見つかりません。条件を変えて試してみてください。'
              : 'まだ集計データがありません。映画を登録すると俳優が反映されます。'}
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 14,
          }}>
            {actors.map(a => (
              <Link key={a.person_id} href={`/people/${a.person_id}`} style={{
                textDecoration: 'none', color: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: 12, borderRadius: 10,
                background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
                transition: 'border-color 0.15s',
              }}>
                {a.profile_path ? (
                  <img src={`${TMDB_IMG}/w185${a.profile_path}`} alt={a.name}
                    loading="lazy"
                    style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ff7675, #fd79a8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 32, fontWeight: 700,
                  }}>
                    {a.name.charAt(0)}
                  </div>
                )}
                <div style={{
                  fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {a.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                  {a.film_count}作品
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
