import type { Metadata } from 'next'
import Link from 'next/link'
import PersonSearch from '../components/PersonSearch'

const TMDB_IMG = 'https://image.tmdb.org/t/p'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const revalidate = 600

export const metadata: Metadata = {
  title: '脚本家一覧 — Filmo',
  description: 'Filmoに登録された映画から、脚本家を作品数順に一覧表示。',
  openGraph: {
    type: 'website',
    title: '脚本家一覧 — Filmo',
    description: 'Filmoに登録された映画から、脚本家を作品数順に一覧表示',
    url: `${APP_URL}/screenwriters`,
    siteName: 'Filmo',
  },
}

interface WriterRow {
  person_id: number
  name: string
  profile_path: string | null
  film_count: number
}

async function fetchWriters(): Promise<WriterRow[]> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data, error } = await admin.rpc('get_filmo_screenwriters', { p_limit: 200, p_offset: 0 })
    if (error) {
      console.error('get_filmo_screenwriters RPC failed:', error)
      return []
    }
    return (data || []) as WriterRow[]
  } catch (e) {
    console.error('fetchWriters failed:', e)
    return []
  }
}

export default async function ScreenwritersPage() {
  const writers = await fetchWriters()

  return (
    <main style={{
      maxWidth: 1100, margin: '0 auto', padding: '24px 16px 80px',
      color: 'var(--fm-text)',
    }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>脚本家一覧</h1>
        <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: 0, lineHeight: 1.6 }}>
          Filmoに登録されている映画から脚本家・原作者を集計しています。<br />
          一覧に名前がない場合は下の検索ボックスでTMDB全体から探せます。
        </p>
      </header>

      <PersonSearch placeholder="脚本家名で検索（TMDB全体から）" filterDepartment="Writing" />

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>
          作品数の多い脚本家 <span style={{ color: 'var(--fm-text-muted)', fontWeight: 500, fontSize: 13 }}>（{writers.length}名）</span>
        </h2>

        {writers.length === 0 ? (
          <p style={{ color: 'var(--fm-text-muted)', fontSize: 14, padding: 24, textAlign: 'center' }}>
            まだ集計データがありません。映画を登録すると脚本家が反映されます。
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 14,
          }}>
            {writers.map(w => (
              <Link key={w.person_id} href={`/?person=${w.person_id}`} style={{
                textDecoration: 'none', color: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: 12, borderRadius: 10,
                background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
              }}>
                {w.profile_path ? (
                  <img src={`${TMDB_IMG}/w185${w.profile_path}`} alt={w.name}
                    loading="lazy"
                    style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2ecc8a, #1abc9c)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 32, fontWeight: 700,
                  }}>
                    {w.name.charAt(0)}
                  </div>
                )}
                <div style={{
                  fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {w.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                  {w.film_count}作品
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
