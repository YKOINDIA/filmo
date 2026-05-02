import type { Metadata } from 'next'
import Link from 'next/link'
import AuthGate from '../../components/AuthGate'
import ProfileActions from '../../components/ProfileActions'

const TMDB_IMG = 'https://image.tmdb.org/t/p'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const revalidate = 300

interface PublicUser {
  id: string
  name: string
  avatar_url: string | null
  bio: string
  best_movie_title: string | null
  best_movie_poster: string | null
  // 公開しないが、SEO 用に「{name}さんの観た映画」等で使う
}

interface PublicList {
  id: string
  slug: string | null
  title: string
  description: string
  items_count: number
  likes_count: number
  posters: string[]
}

interface PublicReviewSummary {
  movie_id: number
  rating: number
  title: string
  poster_path: string | null
}

type ProfileFetchResult =
  | { isPrivate: true }
  | {
      isPrivate?: false
      user: PublicUser
      lists: PublicList[]
      watchedCount: number
      reviewsCount: number
      followersCount: number
      followingCount: number
      recentWatched: PublicReviewSummary[]
    }

async function fetchProfileData(userId: string): Promise<ProfileFetchResult | null> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ユーザー本体(BAN は出さない / 非公開は専用画面)
    const { data: userRow } = await admin
      .from('users')
      .select('id, name, avatar_url, bio, best_movie_title, best_movie_poster, is_banned, is_profile_public')
      .eq('id', userId)
      .maybeSingle()

    if (!userRow || userRow.is_banned) return null
    if (userRow.is_profile_public === false) return { isPrivate: true as const }

    const user: PublicUser = {
      id: userRow.id,
      name: userRow.name || 'Unknown',
      avatar_url: userRow.avatar_url || null,
      bio: userRow.bio || '',
      best_movie_title: userRow.best_movie_title || null,
      best_movie_poster: userRow.best_movie_poster || null,
    }

    // 並列フェッチ
    const [listsRes, watchedRes, reviewsRes, followersRes, followingRes, recentRes] = await Promise.all([
      admin.from('user_lists')
        .select('id, slug, title, description, items_count, likes_count')
        .eq('user_id', userId).eq('is_public', true)
        .gt('items_count', 0)
        .order('updated_at', { ascending: false })
        .limit(20),
      admin.from('watchlists').select('*', { count: 'exact', head: true })
        .eq('user_id', userId).eq('status', 'watched'),
      admin.from('reviews').select('*', { count: 'exact', head: true })
        .eq('user_id', userId).eq('is_draft', false),
      admin.from('follows').select('*', { count: 'exact', head: true })
        .eq('following_id', userId),
      admin.from('follows').select('*', { count: 'exact', head: true })
        .eq('follower_id', userId),
      admin.from('watchlists')
        .select('movie_id, score')
        .eq('user_id', userId).eq('status', 'watched')
        .not('score', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(12),
    ])

    const listRows = (listsRes.data || []) as Omit<PublicList, 'posters'>[]
    const watchedCount = watchedRes.count || 0
    const reviewsCount = reviewsRes.count || 0
    const followersCount = followersRes.count || 0
    const followingCount = followingRes.count || 0

    // ポスター集約
    const allListIds = listRows.map(l => l.id)
    const { data: itemsData } = allListIds.length > 0
      ? await admin.from('list_items')
          .select('list_id, movie_id, position')
          .in('list_id', allListIds)
          .order('position', { ascending: true })
      : { data: [] }

    const itemsByList = new Map<string, number[]>()
    for (const it of (itemsData || []) as { list_id: string; movie_id: number; position: number }[]) {
      const arr = itemsByList.get(it.list_id) || []
      if (arr.length < 5) arr.push(it.movie_id)
      itemsByList.set(it.list_id, arr)
    }

    // 最近観た映画 + リスト用ポスター を同時に取得
    const recentMovieIds = ((recentRes.data || []) as { movie_id: number; score: number | null }[]).map(r => r.movie_id)
    const allMovieIds = [...new Set([...itemsByList.values()].flat().concat(recentMovieIds))]
    const { data: moviesData } = allMovieIds.length > 0
      ? await admin.from('movies').select('tmdb_id, title, poster_path').in('tmdb_id', allMovieIds)
      : { data: [] }
    const movieMap = new Map<number, { title: string; poster_path: string | null }>()
    for (const m of (moviesData || []) as { tmdb_id: number; title: string; poster_path: string | null }[]) {
      movieMap.set(m.tmdb_id, m)
    }

    const lists: PublicList[] = listRows.map(l => {
      const movieIds = itemsByList.get(l.id) || []
      const posters = movieIds
        .map(id => movieMap.get(id)?.poster_path)
        .filter((p): p is string => !!p)
      return { ...l, posters }
    })

    const recentWatched: PublicReviewSummary[] = ((recentRes.data || []) as { movie_id: number; score: number | null }[])
      .map(r => {
        const m = movieMap.get(r.movie_id)
        if (!m) return null
        return {
          movie_id: r.movie_id,
          rating: r.score || 0,
          title: m.title,
          poster_path: m.poster_path,
        }
      })
      .filter((x): x is PublicReviewSummary => x !== null)

    return { user, lists, watchedCount, reviewsCount, followersCount, followingCount, recentWatched }
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const data = await fetchProfileData(id)
  if (!data) {
    return { title: 'プロフィールが見つかりません — Filmo' }
  }
  if (data.isPrivate) {
    return { title: '非公開プロフィール — Filmo', robots: { index: false } }
  }
  const { user, watchedCount, reviewsCount } = data
  const desc = user.bio
    || `${user.name}さんは ${watchedCount}本の映画を観て、${reviewsCount}件のレビューを書いています。`
  return {
    title: `${user.name}のプロフィール — Filmo`,
    description: desc,
    openGraph: {
      type: 'profile',
      title: `${user.name}のプロフィール — Filmo`,
      description: desc,
      url: `${APP_URL}/u/${id}`,
      siteName: 'Filmo',
      images: user.avatar_url ? [{ url: user.avatar_url }] : undefined,
    },
    twitter: {
      card: 'summary',
      title: `${user.name} — Filmo`,
      description: desc,
      images: user.avatar_url ? [user.avatar_url] : undefined,
    },
  }
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fm-text)' }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>{label}</div>
    </div>
  )
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchProfileData(id)

  if (!data) {
    return (
      <div style={{
        minHeight: '100dvh', background: 'var(--fm-bg)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 8 }}>
            プロフィールが見つかりません
          </h1>
          <p style={{ color: 'var(--fm-text-sub)', fontSize: 14 }}>
            このユーザーは存在しないか、利用停止中です。
          </p>
          <Link href="/" style={{ color: 'var(--fm-accent)', fontSize: 14, marginTop: 16, display: 'inline-block' }}>
            Filmoのトップへ
          </Link>
        </div>
      </div>
    )
  }

  if (data.isPrivate) {
    return (
      <div style={{
        minHeight: '100dvh', background: 'var(--fm-bg)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 8 }}>
            非公開プロフィール
          </h1>
          <p style={{ color: 'var(--fm-text-sub)', fontSize: 14, lineHeight: 1.6 }}>
            このユーザーはプロフィールを非公開に設定しています。
          </p>
          <Link href="/" style={{ color: 'var(--fm-accent)', fontSize: 14, marginTop: 16, display: 'inline-block' }}>
            Filmoのトップへ
          </Link>
        </div>
      </div>
    )
  }

  const { user, lists, watchedCount, reviewsCount, followersCount, followingCount, recentWatched } = data

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', color: 'var(--fm-text)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--fm-border)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontSize: 16, fontWeight: 800, letterSpacing: 1.5,
            color: 'var(--fm-text)', textTransform: 'uppercase' as const,
          }}>
            Filmo
          </span>
        </Link>
        <AuthGate hideWhenAuthed>
          <Link href="/" style={{
            padding: '6px 16px', borderRadius: 6, border: 'none',
            background: 'var(--fm-accent)', color: '#fff', fontSize: 12, fontWeight: 600,
            textDecoration: 'none',
          }}>
            無料で始める
          </Link>
        </AuthGate>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 60px' }}>
        {/* Profile header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          {user.avatar_url ? (
            <img src={user.avatar_url} alt=""
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 32, fontWeight: 700, flexShrink: 0,
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fm-text)', margin: 0 }}>
              {user.name}
            </h1>
            {user.bio && (
              <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: '4px 0 0', lineHeight: 1.5 }}>
                {user.bio}
              </p>
            )}
          </div>
          <ProfileActions profileUserId={user.id} profileDisplayName={user.name} />
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: 8, padding: '14px 0',
          borderTop: '1px solid var(--fm-border)', borderBottom: '1px solid var(--fm-border)',
          marginBottom: 24,
        }}>
          <StatBlock value={watchedCount} label="観た" />
          <StatBlock value={reviewsCount} label="レビュー" />
          <StatBlock value={followersCount} label="フォロワー" />
          <StatBlock value={followingCount} label="フォロー中" />
        </div>

        {/* Best movie */}
        {user.best_movie_title && (
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24,
            padding: 14, background: 'var(--fm-bg-card)', borderRadius: 10,
            border: '1px solid var(--fm-border)',
          }}>
            {user.best_movie_poster && (
              <img src={`${TMDB_IMG}/w154${user.best_movie_poster}`} alt=""
                style={{ width: 50, height: 75, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginBottom: 2 }}>BEST FILM</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fm-text)' }}>{user.best_movie_title}</div>
            </div>
          </div>
        )}

        {/* Recent watched */}
        {recentWatched.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 12px' }}>
              最近観た映画
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: 8,
            }}>
              {recentWatched.map(rw => (
                <div key={rw.movie_id} style={{ position: 'relative' }}>
                  {rw.poster_path ? (
                    <img src={`${TMDB_IMG}/w154${rw.poster_path}`} alt={rw.title}
                      style={{ width: '100%', aspectRatio: '2/3', borderRadius: 4, objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', aspectRatio: '2/3', borderRadius: 4,
                      background: 'var(--fm-bg-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--fm-text-muted)', fontSize: 10, padding: 4,
                    }}>{rw.title}</div>
                  )}
                  {rw.rating > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 4, right: 4,
                      background: 'rgba(0,0,0,0.8)', color: '#ffd700',
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    }}>★{(rw.rating / 2).toFixed(1)}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Public lists */}
        {lists.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 12px' }}>
              公開リスト ({lists.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lists.map(list => (
                <Link
                  key={list.id}
                  href={`/lists/${list.slug || list.id}`}
                  style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    padding: 12, background: 'var(--fm-bg-card)', borderRadius: 10,
                    border: '1px solid var(--fm-border)', textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  {/* Mini posters */}
                  {list.posters.length > 0 ? (
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(3, 24px)', gap: 2,
                      flexShrink: 0,
                    }}>
                      {list.posters.slice(0, 3).map((p, i) => (
                        <div key={i} style={{
                          width: 24, height: 36, borderRadius: 2,
                          background: `url(${TMDB_IMG}/w154${p}) center/cover`,
                        }} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ width: 76, height: 36, background: 'var(--fm-bg-secondary)', borderRadius: 4, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: 'var(--fm-text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {list.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 2 }}>
                      {list.items_count}本{list.likes_count > 0 ? ` ・ ♥ ${list.likes_count}` : ''}
                    </div>
                  </div>
                  <span style={{ color: 'var(--fm-text-muted)', fontSize: 18, flexShrink: 0 }}>›</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA — ログイン済みには表示しない */}
        <AuthGate hideWhenAuthed>
          <div style={{
            padding: 24, borderRadius: 10,
            background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
            textAlign: 'center',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 8px' }}>
              あなたも Filmo を始めよう
            </h3>
            <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: '0 0 16px' }}>
              観た映画を記録して、リストを作って、世界中の映画ファンとつながろう。
            </p>
            <Link href="/" style={{
              display: 'inline-block', padding: '10px 28px', borderRadius: 8,
              background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
            }}>
              無料で始める
            </Link>
          </div>
        </AuthGate>
      </main>
    </div>
  )
}
