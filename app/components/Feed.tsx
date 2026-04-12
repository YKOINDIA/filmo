'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { addPoints, POINT_CONFIG, checkDailyLikeLimit, incrementDailyLikeCount } from '../lib/points'
import { showToast } from '../lib/toast'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

interface FeedItem {
  type: 'review' | 'watch' | 'clip'
  user_id: string
  user_name: string
  user_avatar: string | null
  movie_id: number
  movie_title: string
  movie_poster: string | null
  score?: number
  review_body?: string
  review_id?: string
  has_spoiler?: boolean
  likes_count?: number
  liked_by_me?: boolean
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}時間前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}日前`
  return new Date(dateStr).toLocaleDateString('ja-JP')
}

function StarDisplay({ score }: { score: number }) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    if (score >= i) stars.push(<span key={i} className="star-filled">★</span>)
    else if (score >= i - 0.5) stars.push(<span key={i} className="star-filled">★</span>)
    else stars.push(<span key={i} className="star-empty">★</span>)
  }
  return <span style={{ fontSize: 14 }}>{stars}</span>
}

export default function Feed({ userId, onOpenWork }: {
  userId: string
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'following' | 'everyone'>('following')
  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadFeed()
  }, [tab])

  const loadFeed = async () => {
    setLoading(true)
    try {
      let userIds: string[] = []
      if (tab === 'following') {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId)
        userIds = (follows as { following_id: string }[])?.map((f) => f.following_id) || []
        if (userIds.length === 0) {
          setItems([])
          setLoading(false)
          return
        }
      }

      // レビューを取得
      let reviewQuery = supabase
        .from('reviews')
        .select('id, user_id, movie_id, score, body, has_spoiler, likes_count, created_at, is_draft, is_hidden, users(name, avatar_url), movies(title, poster_path)')
        .eq('is_draft', false)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(30)

      if (tab === 'following' && userIds.length > 0) {
        reviewQuery = reviewQuery.in('user_id', userIds)
      }

      const { data: reviews } = await reviewQuery

      // 鑑賞記録を取得
      let watchQuery = supabase
        .from('watchlists')
        .select('user_id, movie_id, status, created_at, users(name, avatar_url), movies(title, poster_path)')
        .order('created_at', { ascending: false })
        .limit(30)

      if (tab === 'following' && userIds.length > 0) {
        watchQuery = watchQuery.in('user_id', userIds)
      }

      const { data: watches } = await watchQuery

      // いいね状況を取得
      const reviewIds = reviews?.map((r: { id: string }) => r.id) || []
      if (reviewIds.length > 0) {
        const { data: myLikes } = await supabase
          .from('likes')
          .select('review_id')
          .eq('user_id', userId)
          .in('review_id', reviewIds)
        setLikedReviews(new Set(myLikes?.map((l: { review_id: string }) => l.review_id) || []))
      }

      const feedItems: FeedItem[] = []

      reviews?.forEach((r: Record<string, unknown>) => {
        const u = r.users as { name: string; avatar_url: string | null } | null
        const m = r.movies as { title: string; poster_path: string | null } | null
        feedItems.push({
          type: 'review',
          user_id: r.user_id as string,
          user_name: u?.name || '名無し',
          user_avatar: u?.avatar_url || null,
          movie_id: r.movie_id as number,
          movie_title: m?.title || '',
          movie_poster: m?.poster_path || null,
          score: r.score as number,
          review_body: r.body as string,
          review_id: r.id as string,
          has_spoiler: r.has_spoiler as boolean,
          likes_count: r.likes_count as number,
          created_at: r.created_at as string,
        })
      })

      watches?.forEach((w: Record<string, unknown>) => {
        const u = w.users as { name: string; avatar_url: string | null } | null
        const m = w.movies as { title: string; poster_path: string | null } | null
        feedItems.push({
          type: (w.status as string) === 'watched' ? 'watch' : 'clip',
          user_id: w.user_id as string,
          user_name: u?.name || '名無し',
          user_avatar: u?.avatar_url || null,
          movie_id: w.movie_id as number,
          movie_title: m?.title || '',
          movie_poster: m?.poster_path || null,
          created_at: w.created_at as string,
        })
      })

      feedItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setItems(feedItems.slice(0, 50))
    } catch { /* ignore */ }
    setLoading(false)
  }

  const handleLike = async (reviewId: string, reviewUserId: string) => {
    if (likedReviews.has(reviewId)) {
      // Unlike
      await supabase.from('likes').delete().eq('user_id', userId).eq('review_id', reviewId)
      await supabase.from('reviews').update({ likes_count: Math.max(0, (items.find(i => i.review_id === reviewId)?.likes_count || 1) - 1) }).eq('id', reviewId)
      setLikedReviews(prev => { const s = new Set(prev); s.delete(reviewId); return s })
      setItems(prev => prev.map(i => i.review_id === reviewId ? { ...i, likes_count: Math.max(0, (i.likes_count || 1) - 1) } : i))
      return
    }

    const canLike = await checkDailyLikeLimit(userId)
    if (!canLike) {
      showToast('いいねの1日上限(50回)に達しました')
      return
    }

    await supabase.from('likes').insert({ user_id: userId, review_id: reviewId })
    await supabase.from('reviews').update({ likes_count: (items.find(i => i.review_id === reviewId)?.likes_count || 0) + 1 }).eq('id', reviewId)
    await incrementDailyLikeCount(userId)
    await addPoints(userId, POINT_CONFIG.LIKE_SEND, 'いいね送信')
    if (reviewUserId !== userId) {
      await addPoints(reviewUserId, POINT_CONFIG.LIKE_RECEIVE, 'いいね受信')
    }

    setLikedReviews(prev => new Set(prev).add(reviewId))
    setItems(prev => prev.map(i => i.review_id === reviewId ? { ...i, likes_count: (i.likes_count || 0) + 1, liked_by_me: true } : i))
  }

  const actionText = (item: FeedItem) => {
    if (item.type === 'review') return 'がレビューしました'
    if (item.type === 'watch') return 'を鑑賞済みにしました'
    return 'をClip!しました'
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* タブ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['following', 'everyone'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--fm-border)',
              background: tab === t ? 'var(--fm-accent)' : 'var(--fm-bg-card)',
              color: tab === t ? '#fff' : 'var(--fm-text-sub)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}>
            {t === 'following' ? 'フォロー中' : 'みんな'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fm-text-sub)' }}>読み込み中...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <div style={{ color: 'var(--fm-text-sub)', marginBottom: 8 }}>
            {tab === 'following' ? 'フォローしているユーザーがいません' : 'まだアクティビティがありません'}
          </div>
          {tab === 'following' && (
            <div style={{ color: 'var(--fm-text-muted)', fontSize: 13 }}>
              ユーザーをフォローして最新のレビューをチェック!
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((item, idx) => (
            <div key={idx} className="animate-fade-in" style={{
              background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16,
              border: '1px solid var(--fm-border)',
            }}>
              {/* ユーザー情報 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--fm-bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  overflow: 'hidden',
                }}>
                  {item.user_avatar ? (
                    <img src={item.user_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : '👤'}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{item.user_name}</span>
                  <span style={{ color: 'var(--fm-text-sub)', fontSize: 13 }}>{actionText(item)}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>{timeAgo(item.created_at)}</span>
              </div>

              {/* 作品情報 */}
              <div style={{ display: 'flex', gap: 12, cursor: 'pointer' }}
                onClick={() => onOpenWork(item.movie_id)}>
                {item.movie_poster && (
                  <img src={`${TMDB_IMG}/w92${item.movie_poster}`} alt={item.movie_title}
                    style={{ width: 60, height: 90, borderRadius: 6, objectFit: 'cover' }} loading="lazy" />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{item.movie_title}</div>
                  {item.score && (
                    <div style={{ marginBottom: 4 }}>
                      <StarDisplay score={item.score} />
                      <span style={{ marginLeft: 6, fontSize: 13, fontWeight: 700, color: 'var(--fm-accent)' }}>{item.score}</span>
                    </div>
                  )}
                  {item.review_body && (
                    <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', lineHeight: 1.5 }}>
                      {item.has_spoiler ? (
                        <span className="spoiler-text" onClick={e => { e.stopPropagation(); (e.target as HTMLElement).classList.toggle('revealed') }}>
                          {item.review_body.substring(0, 100)}
                        </span>
                      ) : (
                        item.review_body.substring(0, 100) + (item.review_body.length > 100 ? '...' : '')
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* アクションバー */}
              {item.type === 'review' && item.review_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--fm-border)' }}>
                  <button
                    onClick={() => handleLike(item.review_id!, item.user_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, background: 'none',
                      border: 'none', cursor: 'pointer', fontSize: 14,
                      color: likedReviews.has(item.review_id) ? 'var(--fm-danger)' : 'var(--fm-text-sub)',
                    }}>
                    {likedReviews.has(item.review_id) ? '❤️' : '🤍'} {item.likes_count || 0}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
