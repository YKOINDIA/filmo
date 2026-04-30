import type { Metadata } from 'next'
import Link from 'next/link'
import PersonSearch from '../components/PersonSearch'

const TMDB_IMG = 'https://image.tmdb.org/t/p'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const revalidate = 600

export const metadata: Metadata = {
  title: '監督一覧 — Filmo',
  description: 'Filmoに登録された映画から、監督を作品数順に一覧表示。お気に入りの監督の作品をまとめて発見しよう。',
  openGraph: {
    type: 'website',
    title: '監督一覧 — Filmo',
    description: 'Filmoに登録された映画から、監督を作品数順に一覧表示',
    url: `${APP_URL}/directors`,
    siteName: 'Filmo',
  },
}

interface DirectorRow {
  person_id: number
  name: string
  profile_path: string | null
  film_count: number
}

async function fetchDirectors(): Promise<DirectorRow[]> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data, error } = await admin.rpc('get_filmo_directors', { p_limit: 200, p_offset: 0 })
    if (error) {
      console.error('get_filmo_directors RPC failed:', error)
      return []
    }
    return (data || []) as DirectorRow[]
  } catch (e) {
    console.error('fetchDirectors failed:', e)
    return []
  }
}

export default async function DirectorsPage() {
  const directors = await fetchDirectors()

  return (
    <main style={{
      maxWidth: 1100, margin: '0 auto', padding: '24px 16px 80px',
      color: 'var(--fm-text)',
    }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>監督一覧</h1>
        <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: 0, lineHeight: 1.6 }}>
          Filmoに登録されている映画から監督を集計しています。<br />
          一覧に名前がない場合は下の検索ボックスでTMDB全体から探せます（例: 泉原航一）。
        </p>
      </header>

      <PersonSearch placeholder="監督名で検索（TMDB全体から）" filterDepartment="Directing" />

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
          作品数の多い監督 <span style={{ color: 'var(--fm-text-muted)', fontWeight: 500, fontSize: 13 }}>（{directors.length}名）</span>
        </h2>

        {directors.length === 0 ? (
          <p style={{ color: 'var(--fm-text-muted)', fontSize: 14, padding: 24, textAlign: 'center' }}>
            まだ集計データがありません。映画を登録すると監督が反映されます。
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 14,
          }}>
            {directors.map(d => (
              <Link key={d.person_id} href={`/?person=${d.person_id}`} style={{
                textDecoration: 'none', color: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: 12, borderRadius: 10,
                background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
                transition: 'border-color 0.15s',
              }}>
                {d.profile_path ? (
                  <img src={`${TMDB_IMG}/w185${d.profile_path}`} alt={d.name}
                    loading="lazy"
                    style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 32, fontWeight: 700,
                  }}>
                    {d.name.charAt(0)}
                  </div>
                )}
                <div style={{
                  fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                  {d.film_count}作品
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
