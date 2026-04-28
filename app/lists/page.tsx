import type { Metadata } from 'next'
import Link from 'next/link'

const TMDB_IMG = 'https://image.tmdb.org/t/p'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const revalidate = 300 // 5分キャッシュ

export const metadata: Metadata = {
  title: 'みんなの映画リスト — Filmo',
  description: '映画ファンが作ったテーマ別の映画リスト。「90年代の名作」「初めて英語を勉強する人向け」「親と映画館で見た映画」など、共感できるリストを発見しよう。',
  openGraph: {
    type: 'website',
    title: 'みんなの映画リスト — Filmo',
    description: '映画ファンが作ったテーマ別の映画リストを発見しよう',
    url: `${APP_URL}/lists`,
    siteName: 'Filmo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'みんなの映画リスト — Filmo',
    description: '映画ファンが作ったテーマ別の映画リストを発見しよう',
  },
}

interface ListSummary {
  id: string
  slug: string | null
  title: string
  description: string
  items_count: number
  likes_count: number
  user_id: string
  user_name: string
  user_avatar: string | null
  posters: string[]
}

async function fetchListsSummary(): Promise<{ popular: ListSummary[]; recent: ListSummary[] }> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const [popularRes, recentRes] = await Promise.all([
      admin.from('user_lists')
        .select('id, slug, title, description, items_count, likes_count, user_id')
        .eq('is_public', true)
        .gt('items_count', 0)
        .order('likes_count', { ascending: false })
        .limit(30),
      admin.from('user_lists')
        .select('id, slug, title, description, items_count, likes_count, user_id')
        .eq('is_public', true)
        .gt('items_count', 0)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const popular = (popularRes.data || []) as Omit<ListSummary, 'user_name' | 'user_avatar' | 'posters'>[]
    const recent = (recentRes.data || []) as Omit<ListSummary, 'user_name' | 'user_avatar' | 'posters'>[]

    const allLists = [...popular, ...recent]
    if (allLists.length === 0) return { popular: [], recent: [] }

    const userIds = [...new Set(allLists.map(l => l.user_id))]
    const listIds = allLists.map(l => l.id)

    const [usersRes, itemsRes] = await Promise.all([
      admin.from('users').select('id, name, avatar_url').in('id', userIds),
      admin.from('list_items').select('list_id, movie_id, position').in('list_id', listIds).order('position', { ascending: true }),
    ])

    const userMap = new Map<string, { name: string; avatar_url: string | null }>()
    for (const u of (usersRes.data || []) as { id: string; name: string; avatar_url: string | null }[]) {
      userMap.set(u.id, u)
    }

    const itemsByList = new Map<string, number[]>()
    for (const it of (itemsRes.data || []) as { list_id: string; movie_id: number; position: number }[]) {
      const arr = itemsByList.get(it.list_id) || []
      if (arr.length < 5) arr.push(it.movie_id)
      itemsByList.set(it.list_id, arr)
    }

    const allMovieIds = [...new Set([...itemsByList.values()].flat())]
    const moviesRes = allMovieIds.length > 0
      ? await admin.from('movies').select('tmdb_id, poster_path').in('tmdb_id', allMovieIds)
      : { data: [] }
    const posterMap = new Map<number, string>()
    for (const m of (moviesRes.data || []) as { tmdb_id: number; poster_path: string | null }[]) {
      if (m.poster_path) posterMap.set(m.tmdb_id, m.poster_path)
    }

    const enrich = (l: Omit<ListSummary, 'user_name' | 'user_avatar' | 'posters'>): ListSummary => {
      const u = userMap.get(l.user_id)
      const movieIds = itemsByList.get(l.id) || []
      const posters = movieIds.map(id => posterMap.get(id)).filter((p): p is string => !!p)
      return {
        ...l,
        user_name: u?.name || 'Unknown',
        user_avatar: u?.avatar_url || null,
        posters,
      }
    }

    return {
      popular: popular.map(enrich),
      recent: recent.map(enrich).filter(l => !popular.find(p => p.id === l.id)).slice(0, 20),
    }
  } catch {
    return { popular: [], recent: [] }
  }
}

function ListCard({ list }: { list: ListSummary }) {
  const href = `/lists/${list.slug || list.id}`
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <article style={{
        background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
        borderRadius: 12, padding: 14, height: '100%',
        display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'border-color 0.15s, transform 0.15s',
      }}>
        {/* Posters mosaic */}
        {list.posters.length > 0 ? (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 4, height: 90, overflow: 'hidden', borderRadius: 6,
          }}>
            {list.posters.slice(0, 5).map((p, i) => (
              <div key={i} style={{
                background: `url(${TMDB_IMG}/w154${p}) center/cover`,
                aspectRatio: '2/3',
              }} />
            ))}
          </div>
        ) : (
          <div style={{
            height: 90, borderRadius: 6, background: 'var(--fm-bg-secondary)',
          }} />
        )}

        <div>
          <h2 style={{
            fontSize: 15, fontWeight: 700, color: 'var(--fm-text)',
            margin: '0 0 6px', lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {list.title}
          </h2>
          {list.description && (
            <p style={{
              fontSize: 12, color: 'var(--fm-text-sub)', margin: '0 0 8px',
              lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {list.description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--fm-text-muted)' }}>
            <span>{list.items_count}本</span>
            {list.likes_count > 0 && <span>♥ {list.likes_count}</span>}
            <span style={{ marginLeft: 'auto' }}>by {list.user_name}</span>
          </div>
        </div>
      </article>
    </Link>
  )
}

export default async function ListsIndexPage() {
  const { popular, recent } = await fetchListsSummary()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', color: 'var(--fm-text)' }}>
      <header style={{
        borderBottom: '1px solid var(--fm-border)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'var(--fm-bg)', zIndex: 10,
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontSize: 16, fontWeight: 800, letterSpacing: 1.5,
            color: 'var(--fm-text)', textTransform: 'uppercase' as const,
          }}>
            Filmo
          </span>
        </Link>
        <Link href="/" style={{
          padding: '6px 16px', borderRadius: 6, border: 'none',
          background: 'var(--fm-accent)', color: '#fff', fontSize: 12, fontWeight: 600,
          textDecoration: 'none',
        }}>
          無料で始める
        </Link>
      </header>

      <main style={{ maxWidth: 980, margin: '0 auto', padding: '24px 16px 60px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 8px' }}>
          みんなの映画リスト
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fm-text-sub)', margin: '0 0 32px', lineHeight: 1.6 }}>
          映画ファンが作ったテーマ別のリスト。共感できるリストから新しい1本を見つけよう。
        </p>

        {popular.length === 0 && recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--fm-text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>まだ公開リストがありません</div>
            <Link href="/" style={{ color: 'var(--fm-accent)', fontSize: 14, textDecoration: 'none' }}>
              最初のリストを作る →
            </Link>
          </div>
        ) : (
          <>
            {popular.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 16px' }}>
                  🔥 人気のリスト
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 12,
                }}>
                  {popular.map(list => <ListCard key={list.id} list={list} />)}
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 16px' }}>
                  ✨ 新着リスト
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 12,
                }}>
                  {recent.map(list => <ListCard key={list.id} list={list} />)}
                </div>
              </section>
            )}
          </>
        )}

        <div style={{
          marginTop: 60, padding: 24, borderRadius: 10,
          background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
          textAlign: 'center',
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 8px' }}>
            自分のリストを公開しよう
          </h3>
          <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: '0 0 16px' }}>
            あなたの好きな映画をテーマ別にまとめて、みんなとシェア。
          </p>
          <Link href="/" style={{
            display: 'inline-block', padding: '10px 28px', borderRadius: 8,
            background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 600,
            textDecoration: 'none',
          }}>
            無料で始める
          </Link>
        </div>
      </main>
    </div>
  )
}
