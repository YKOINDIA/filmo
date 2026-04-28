'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TMDB_IMG_POSTER = 'https://image.tmdb.org/t/p/w342'
import { getLevelFromPoints, LEVEL_TITLES } from '../lib/points'
import Settings from './Settings'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

const ALL_GENRES = [
  'アクション', 'コメディ', 'SF', 'ホラー', '恋愛', 'ミステリー',
  'アニメ', 'ドラマ', 'ドキュメンタリー', 'ファンタジー', 'スリラー',
  'アドベンチャー', '歴史', '音楽', '戦争', 'ウエスタン', '犯罪',
]

// 自分の公開プロフィール (/u/[id]) URL を友達にシェアするボタン
function ShareMyProfileButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/u/${userId}`
    : `https://filmo.me/u/${userId}`
  const text = `${userName}のFilmoプロフィール`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }
  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer')
  }
  const shareLine = () => {
    window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }
  const systemShare = async () => {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return
    try { await navigator.share({ title: text, url }) } catch { /* canceled */ }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--fm-accent)',
          background: 'rgba(108,92,231,0.12)', color: 'var(--fm-accent)',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        プロフィールを友達に送る
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 9000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: 'var(--fm-bg)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
              padding: '20px 16px 32px',
            }}
          >
            <div style={{
              width: 40, height: 4, background: 'var(--fm-border)',
              borderRadius: 2, margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 8, textAlign: 'center' }}>
              プロフィールをシェア
            </div>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', textAlign: 'center', marginBottom: 20 }}>
              友達にこのリンクを送ろう
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              <button onClick={shareTwitter}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', background: 'transparent', border: '1px solid var(--fm-border)', borderRadius: 10, cursor: 'pointer', color: 'var(--fm-text)' }}>
                <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>𝕏</span>
                <span style={{ fontSize: 11 }}>Xで投稿</span>
              </button>
              <button onClick={shareLine}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', background: 'transparent', border: '1px solid var(--fm-border)', borderRadius: 10, cursor: 'pointer', color: 'var(--fm-text)' }}>
                <span style={{ fontSize: 22, lineHeight: 1, color: '#06C755', fontWeight: 700 }}>LINE</span>
                <span style={{ fontSize: 11 }}>LINEで送る</span>
              </button>
              <button onClick={copyLink}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', background: 'transparent', border: '1px solid var(--fm-border)', borderRadius: 10, cursor: 'pointer', color: 'var(--fm-text)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span style={{ fontSize: 11 }}>{copied ? 'コピー済' : 'リンクコピー'}</span>
              </button>
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
                <button onClick={systemShare}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', background: 'transparent', border: '1px solid var(--fm-border)', borderRadius: 10, cursor: 'pointer', color: 'var(--fm-text)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  <span style={{ fontSize: 11 }}>その他</span>
                </button>
              ) : (
                <div />
              )}
            </div>

            <div style={{
              padding: '10px 12px', background: 'var(--fm-bg-secondary)',
              borderRadius: 8, fontSize: 12, color: 'var(--fm-text-sub)',
              wordBreak: 'break-all', marginBottom: 16, fontFamily: 'monospace',
            }}>
              {url}
            </div>

            <button onClick={() => setOpen(false)}
              style={{
                width: '100%', padding: '12px', background: 'transparent',
                border: '1px solid var(--fm-border)', borderRadius: 10,
                color: 'var(--fm-text-sub)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}

type WatchStatus = 'watched' | 'want' | 'watching'
type SortKey = 'created_at' | 'score' | 'release_year' | 'watched_at'

interface ProfileUser {
  id: string
  email: string
  name: string
  avatar_url: string | null
  bio: string
  favorite_genres: string[]
  level: number
  points: number
  login_streak: number
  best_movie_title: string | null
  best_movie_poster: string | null
}

interface Props {
  user: ProfileUser
  onUpdate: (u: Partial<ProfileUser>) => void
  onLogout: () => void
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}

interface WatchlistItem {
  id: string
  movie_id: number
  status: string
  score: number | null
  watched_at: string | null
  created_at: string
  // Embedded movie data (merged from movies collection after fetch)
  movie_title?: string
  movie_poster?: string | null
  movie_release_date?: string | null
}

interface ReviewItem {
  id: string
  movie_id: number
  score: number
  body: string | null
  created_at: string
  movie_title?: string
  movie_poster?: string | null
}

interface FanItem {
  id: string
  person_id: number
  person_name: string
  person_image: string | null
  person_type: string
}

interface TitleItem {
  id: string
  earned_at: string
  title_name?: string
  title_description?: string
  title_icon?: string
  title_rarity?: string
}

interface TMDBResult {
  id: number
  title?: string
  name?: string
  poster_path: string | null
}

export default function Profile({ user, onUpdate, onLogout, onOpenWork }: Props) {
  const [showSettings, setShowSettings] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(user.name)
  const [editBio, setEditBio] = useState(user.bio || '')
  const [editGenres, setEditGenres] = useState<string[]>(user.favorite_genres || [])
  const [editBestTitle, setEditBestTitle] = useState(user.best_movie_title || '')
  const [editBestPoster, setEditBestPoster] = useState(user.best_movie_poster || '')
  const [bestMovieQuery, setBestMovieQuery] = useState('')
  const [bestMovieResults, setBestMovieResults] = useState<TMDBResult[]>([])
  const [searchingBest, setSearchingBest] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [watchedCount, setWatchedCount] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [statsLoading, setStatsLoading] = useState(true)

  const [watchTab, setWatchTab] = useState<WatchStatus>('watched')
  const [watchSort, setWatchSort] = useState<SortKey>('created_at')
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [watchLoading, setWatchLoading] = useState(false)

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  const [fans, setFans] = useState<FanItem[]>([])
  const [fansLoading, setFansLoading] = useState(false)

  const [titles, setTitles] = useState<TitleItem[]>([])
  const [titlesLoading, setTitlesLoading] = useState(false)

  const levelInfo = getLevelFromPoints(user.points)

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true)
      const [watched, revs, followers, following] = await Promise.all([
        supabase.from('watchlists').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'watched'),
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_draft', false),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
      ])
      setWatchedCount(watched.count || 0)
      setReviewCount(revs.count || 0)
      setFollowerCount(followers.count || 0)
      setFollowingCount(following.count || 0)
      setStatsLoading(false)
    }
    fetchStats()
  }, [user.id])

  // Fetch watchlist
  const fetchWatchlist = useCallback(async () => {
    setWatchLoading(true)
    const statusMap: Record<WatchStatus, string> = {
      watched: 'watched',
      want: 'want',
      watching: 'watching',
    }
    let query = supabase
      .from('watchlists')
      .select('id, movie_id, status, score, watched_at, created_at')
      .eq('user_id', user.id)
      .eq('status', statusMap[watchTab])

    if (watchSort === 'created_at') {
      query = query.order('created_at', { ascending: false })
    } else if (watchSort === 'score') {
      query = query.order('score', { ascending: false })
    } else if (watchSort === 'watched_at') {
      query = query.order('watched_at', { ascending: false })
    } else if (watchSort === 'release_year') {
      query = query.order('created_at', { ascending: false })
    }

    const { data } = await query.limit(50)
    let items = (data as unknown as WatchlistItem[]) || []

    // Fetch movie metadata from movies collection to get title/poster
    if (items.length > 0) {
      const movieIds = [...new Set(items.map(i => i.movie_id))]
      try {
        const { data: movieData } = await supabase
          .from('movies')
          .select('tmdb_id, title, poster_path, release_date')
          .in('tmdb_id', movieIds)
        const movieMap = new Map<number, { title: string; poster_path: string | null; release_date: string | null }>()
        if (movieData) {
          for (const m of movieData as unknown as { tmdb_id: number; title: string; poster_path: string | null; release_date: string | null }[]) {
            movieMap.set(m.tmdb_id, m)
          }
        }
        items = items.map(item => {
          const movie = movieMap.get(item.movie_id)
          return {
            ...item,
            movie_title: item.movie_title || movie?.title,
            movie_poster: item.movie_poster || movie?.poster_path,
            movie_release_date: item.movie_release_date || movie?.release_date,
          }
        })
      } catch { /* continue without movie metadata */ }
    }

    if (watchSort === 'release_year') {
      items.sort((a, b) => {
        const ya = a.movie_release_date ? new Date(a.movie_release_date).getFullYear() : 0
        const yb = b.movie_release_date ? new Date(b.movie_release_date).getFullYear() : 0
        return yb - ya
      })
    }

    setWatchlist(items)
    setWatchLoading(false)
  }, [user.id, watchTab, watchSort])

  useEffect(() => {
    fetchWatchlist()
  }, [fetchWatchlist])

  // Fetch reviews
  useEffect(() => {
    const fetch = async () => {
      setReviewsLoading(true)
      const { data } = await supabase
        .from('reviews')
        .select('id, movie_id, score, body, created_at')
        .eq('user_id', user.id)
        .eq('is_draft', false)
        .order('created_at', { ascending: false })
        .limit(30)
      let items = (data as unknown as ReviewItem[]) || []
      // Merge movie metadata
      if (items.length > 0) {
        const movieIds = [...new Set(items.map(i => i.movie_id))]
        try {
          const { data: movieData } = await supabase.from('movies').select('tmdb_id, title, poster_path').in('tmdb_id', movieIds)
          const movieMap = new Map<number, { title: string; poster_path: string | null }>()
          if (movieData) {
            for (const m of movieData as unknown as { tmdb_id: number; title: string; poster_path: string | null }[]) {
              movieMap.set(m.tmdb_id, m)
            }
          }
          items = items.map(item => {
            const movie = movieMap.get(item.movie_id)
            return { ...item, movie_title: item.movie_title || movie?.title, movie_poster: item.movie_poster || movie?.poster_path }
          })
        } catch { /* continue without movie metadata */ }
      }
      setReviews(items)
      setReviewsLoading(false)
    }
    fetch()
  }, [user.id])

  // Fetch fans (people)
  useEffect(() => {
    const fetch = async () => {
      setFansLoading(true)
      const { data } = await supabase
        .from('fans')
        .select('id, person_id, person_name, person_image, person_type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setFans((data as unknown as FanItem[]) || [])
      setFansLoading(false)
    }
    fetch()
  }, [user.id])

  // Fetch earned titles
  useEffect(() => {
    const fetch = async () => {
      setTitlesLoading(true)
      const { data } = await supabase
        .from('user_earned_titles')
        .select('id, earned_at, title_name, title_description, title_icon, title_rarity')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false })
      setTitles((data as unknown as TitleItem[]) || [])
      setTitlesLoading(false)
    }
    fetch()
  }, [user.id])

  // Compress image to WebP, resize to max dimensions
  const compressImage = (file: File, maxSize = 200, quality = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          blob => {
            if (!blob) return reject(new Error('Compression failed'))
            resolve(new File([blob], `avatar.webp`, { type: 'image/webp' }))
          },
          'image/webp',
          quality,
        )
      }
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = URL.createObjectURL(file)
    })
  }

  // Avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const compressed = await compressImage(file)
      const path = `avatars/${user.id}/${Date.now()}.webp`
      const { data: uploadData, error: uploadError } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true })
      if (uploadError) throw uploadError
      const fileId = uploadData?.id || path
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileId)
      const avatar_url = urlData.publicUrl
      await supabase.from('users').update({ avatar_url }).eq('id', user.id)
      onUpdate({ avatar_url })
    } catch (err) {
      console.error('Avatar upload failed:', err)
    }
    setUploadingAvatar(false)
  }

  // Best movie search
  const searchBestMovie = async () => {
    if (!bestMovieQuery.trim()) return
    setSearchingBest(true)
    try {
      const res = await fetch(`/api/tmdb?action=search&query=${encodeURIComponent(bestMovieQuery)}`)
      const data = await res.json()
      setBestMovieResults(data.results?.slice(0, 8) || [])
    } catch {
      setBestMovieResults([])
    }
    setSearchingBest(false)
  }

  const selectBestMovie = (movie: TMDBResult) => {
    setEditBestTitle(movie.title || movie.name || '')
    setEditBestPoster(movie.poster_path || '')
    setBestMovieResults([])
    setBestMovieQuery('')
  }

  // Save profile
  const handleSave = async () => {
    setSaving(true)
    const updates: Partial<ProfileUser> = {
      name: editName,
      bio: editBio,
      favorite_genres: editGenres,
      best_movie_title: editBestTitle || null,
      best_movie_poster: editBestPoster || null,
    }
    await supabase.from('users').update(updates).eq('id', user.id)
    onUpdate(updates)
    setEditing(false)
    setSaving(false)
  }

  const toggleGenre = (g: string) => {
    setEditGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  const renderStars = (score: number) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} style={{ color: i <= score ? 'var(--fm-star)' : 'var(--fm-text-muted)', fontSize: 14 }}>
          ★
        </span>
      )
    }
    return stars
  }

  if (showSettings) {
    return <Settings userId={user.id} onBack={() => setShowSettings(false)} />
  }

  return (
    <div className="animate-fade-in" style={{ padding: '16px', maxWidth: 600, margin: '0 auto' }}>
      {/* Profile Header */}
      <div style={{
        background: 'var(--fm-bg-card)', borderRadius: 16, padding: 24,
        border: '1px solid var(--fm-border)', marginBottom: 16, textAlign: 'center',
      }}>
        {/* Avatar */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
            border: `3px solid ${levelInfo.color}`,
            background: 'var(--fm-bg-secondary)',
          }}>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, color: 'var(--fm-text-sub)',
              }}>
                {user.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <label style={{
            position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: '50%',
            background: 'var(--fm-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: '2px solid var(--fm-bg-card)',
            opacity: uploadingAvatar ? 0.5 : 1,
          }}>
            <span style={{ fontSize: 14, color: '#fff' }}>{uploadingAvatar ? '...' : '+'}</span>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar}
              style={{ display: 'none' }} />
          </label>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 4px' }}>{user.name}</h2>
        {user.bio && (
          <p style={{ color: 'var(--fm-text-sub)', fontSize: 13, margin: '0 0 8px', lineHeight: 1.5 }}>{user.bio}</p>
        )}

        {/* Level Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px',
          borderRadius: 20, background: `${levelInfo.color}22`, border: `1px solid ${levelInfo.color}55`,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: levelInfo.color }}>
            Lv.{levelInfo.level} {levelInfo.title}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>{user.points.toLocaleString()} pt</div>

        {/* Favorite Genres */}
        {user.favorite_genres && user.favorite_genres.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 10 }}>
            {user.favorite_genres.map(g => (
              <span key={g} style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 12,
                background: 'var(--fm-bg-secondary)', color: 'var(--fm-text-sub)',
                border: '1px solid var(--fm-border)',
              }}>{g}</span>
            ))}
          </div>
        )}

        {/* Login Streak */}
        {user.login_streak > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fm-warning)' }}>
            {'\uD83D\uDD25'} {user.login_streak}日連続ログイン
          </div>
        )}
      </div>

      {/* Best Movie */}
      {user.best_movie_title && (
        <div style={{
          background: 'var(--fm-bg-card)', borderRadius: 16, padding: 16,
          border: '1px solid var(--fm-border)', marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fm-accent)', marginBottom: 10 }}>
            {'\uD83C\uDFC6'} ベストムービー
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {user.best_movie_poster && (
              <img
                src={`${TMDB_IMG}/w154${user.best_movie_poster}`}
                alt={user.best_movie_title}
                style={{ width: 60, height: 90, borderRadius: 8, objectFit: 'cover' }}
              />
            )}
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)' }}>
              {user.best_movie_title}
            </div>
          </div>
        </div>
      )}

      {/* Edit Button */}
      {!editing && (
        <button onClick={() => {
          setEditName(user.name)
          setEditBio(user.bio || '')
          setEditGenres(user.favorite_genres || [])
          setEditBestTitle(user.best_movie_title || '')
          setEditBestPoster(user.best_movie_poster || '')
          setEditing(true)
        }} style={{
          width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--fm-border)',
          background: 'var(--fm-bg-card)', color: 'var(--fm-text)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', marginBottom: 8,
        }}>
          プロフィールを編集
        </button>
      )}
      {!editing && (
        <div style={{ marginBottom: 16 }}>
          <ShareMyProfileButton userId={user.id} userName={user.name} />
        </div>
      )}

      {/* Edit Mode */}
      {editing && (
        <div style={{
          background: 'var(--fm-bg-card)', borderRadius: 16, padding: 20,
          border: '1px solid var(--fm-border)', marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 16px' }}>
            プロフィール編集
          </h3>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4 }}>名前</label>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--fm-border)',
                background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box',
              }} />
          </div>

          {/* Bio */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4 }}>自己紹介</label>
            <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--fm-border)',
                background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, resize: 'vertical',
                boxSizing: 'border-box', fontFamily: 'inherit',
              }} />
          </div>

          {/* Genres */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 6 }}>好きなジャンル</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_GENRES.map(g => (
                <button key={g} onClick={() => toggleGenre(g)}
                  style={{
                    padding: '6px 12px', borderRadius: 16, border: '1px solid',
                    borderColor: editGenres.includes(g) ? 'var(--fm-accent)' : 'var(--fm-border)',
                    background: editGenres.includes(g) ? 'var(--fm-accent)' : 'var(--fm-bg-input)',
                    color: editGenres.includes(g) ? '#fff' : 'var(--fm-text-sub)',
                    fontSize: 12, cursor: 'pointer', fontWeight: editGenres.includes(g) ? 600 : 400,
                  }}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Best Movie Search */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4 }}>ベストムービー</label>
            {editBestTitle && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                padding: '8px 12px', borderRadius: 8, background: 'var(--fm-bg-secondary)',
              }}>
                {editBestPoster && (
                  <img src={`${TMDB_IMG}/w92${editBestPoster}`} alt="" style={{ width: 30, height: 45, borderRadius: 4, objectFit: 'cover' }} />
                )}
                <span style={{ fontSize: 13, color: 'var(--fm-text)', flex: 1 }}>{editBestTitle}</span>
                <button onClick={() => { setEditBestTitle(''); setEditBestPoster('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--fm-danger)', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                  ×
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={bestMovieQuery}
                onChange={e => setBestMovieQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchBestMovie()}
                placeholder="映画タイトルで検索..."
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--fm-border)',
                  background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 13, boxSizing: 'border-box',
                }}
              />
              <button onClick={searchBestMovie} disabled={searchingBest}
                style={{
                  padding: '0 16px', borderRadius: 10, border: 'none',
                  background: 'var(--fm-accent)', color: '#fff', fontSize: 13,
                  cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                  opacity: searchingBest ? 0.6 : 1,
                }}>
                {searchingBest ? '...' : '検索'}
              </button>
            </div>
            {bestMovieResults.length > 0 && (
              <div style={{
                marginTop: 8, borderRadius: 10, border: '1px solid var(--fm-border)',
                background: 'var(--fm-bg-card)', maxHeight: 240, overflowY: 'auto',
              }}>
                {bestMovieResults.map(m => (
                  <button key={m.id} onClick={() => selectBestMovie(m)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--fm-border)',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      color: 'var(--fm-text)',
                    }}>
                    {m.poster_path ? (
                      <img src={`${TMDB_IMG}/w92${m.poster_path}`} alt="" style={{ width: 28, height: 42, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 28, height: 42, borderRadius: 4, background: 'var(--fm-bg-secondary)' }} />
                    )}
                    <span style={{ fontSize: 13 }}>{m.title || m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Save / Cancel */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)}
              style={{
                flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--fm-border)',
                background: 'var(--fm-bg-secondary)', color: 'var(--fm-text-sub)', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}>
              キャンセル
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{
                flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                background: 'var(--fm-accent)', color: '#fff', fontSize: 14,
                fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1,
              }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16,
      }}>
        {[
          { label: '鑑賞数', value: watchedCount },
          { label: 'レビュー数', value: reviewCount },
          { label: 'フォロワー', value: followerCount },
          { label: 'フォロー', value: followingCount },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--fm-bg-card)', borderRadius: 12, padding: '12px 8px',
            border: '1px solid var(--fm-border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--fm-text)' }}>
              {statsLoading ? '-' : stat.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: 'var(--fm-text-sub)', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Watchlist Tabs */}
      <div style={{
        background: 'var(--fm-bg-card)', borderRadius: 16, padding: 16,
        border: '1px solid var(--fm-border)', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: 'var(--fm-bg-secondary)', borderRadius: 10, padding: 3 }}>
          {([
            { key: 'watched' as WatchStatus, label: '✓ Watched' },
            { key: 'want' as WatchStatus, label: '📌 Watchlist' },
            { key: 'watching' as WatchStatus, label: '📺 Watching' },
          ]).map(t => (
            <button key={t.key} onClick={() => setWatchTab(t.key)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: watchTab === t.key ? 'var(--fm-accent)' : 'transparent',
                color: watchTab === t.key ? '#fff' : 'var(--fm-text-sub)',
                fontSize: 12, fontWeight: watchTab === t.key ? 700 : 400, transition: 'all 0.2s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {([
            { key: 'created_at' as SortKey, label: '投稿日時' },
            { key: 'score' as SortKey, label: 'スコア' },
            { key: 'release_year' as SortKey, label: '製作年' },
            { key: 'watched_at' as SortKey, label: '鑑賞日' },
          ]).map(s => (
            <button key={s.key} onClick={() => setWatchSort(s.key)}
              style={{
                padding: '4px 10px', borderRadius: 8, border: '1px solid',
                borderColor: watchSort === s.key ? 'var(--fm-accent)' : 'var(--fm-border)',
                background: watchSort === s.key ? 'var(--fm-accent)22' : 'transparent',
                color: watchSort === s.key ? 'var(--fm-accent)' : 'var(--fm-text-muted)',
                fontSize: 11, cursor: 'pointer', fontWeight: watchSort === s.key ? 600 : 400,
              }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Poster Grid */}
        {watchLoading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--fm-text-sub)', fontSize: 13 }}>読み込み中...</div>
        ) : watchlist.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--fm-text-muted)', fontSize: 13 }}>
            まだ作品がありません
          </div>
        ) : (
          <div className="poster-grid">
            {watchlist.map(item => (
              <button key={item.id} onClick={() => onOpenWork(item.movie_id)}
                className="card-hover"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
                }}>
                {item.movie_poster ? (
                  <img
                    src={`${TMDB_IMG}/w300${item.movie_poster}`}
                    alt={item.movie_title || ''}
                    style={{ width: '100%', aspectRatio: '2/3', borderRadius: 8, objectFit: 'cover' }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: '2/3', borderRadius: 8,
                    background: 'var(--fm-bg-secondary)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: 'var(--fm-text-muted)', fontSize: 11,
                  }}>
                    No Image
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--fm-text)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.movie_title}
                </div>
                {item.score && (
                  <div style={{ fontSize: 10, marginTop: 2 }}>{renderStars(item.score)}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* My Lists */}
      <MyListsSection userId={user.id} />

      {/* My Reviews */}
      <div style={{
        background: 'var(--fm-bg-card)', borderRadius: 16, padding: 16,
        border: '1px solid var(--fm-border)', marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 12px' }}>
          マイレビュー
        </h3>
        {reviewsLoading ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--fm-text-sub)', fontSize: 13 }}>読み込み中...</div>
        ) : reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--fm-text-muted)', fontSize: 13 }}>
            まだレビューがありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reviews.map(rev => (
              <button key={rev.id} onClick={() => onOpenWork(rev.movie_id)}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px',
                  borderRadius: 10, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-secondary)',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                {rev.movie_poster ? (
                  <img src={`${TMDB_IMG}/w92${rev.movie_poster}`} alt=""
                    style={{ width: 40, height: 60, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 60, borderRadius: 6, background: 'var(--fm-bg-hover)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rev.movie_title}
                  </div>
                  <div style={{ marginTop: 2 }}>{renderStars(rev.score)}</div>
                  {rev.body && (
                    <div style={{
                      fontSize: 12, color: 'var(--fm-text-sub)', marginTop: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {rev.body}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--fm-text-muted)', marginTop: 4 }}>
                    {new Date(rev.created_at).toLocaleDateString('ja-JP')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fan! List */}
      <div style={{
        background: 'var(--fm-bg-card)', borderRadius: 16, padding: 16,
        border: '1px solid var(--fm-border)', marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 12px' }}>
          Fan!
        </h3>
        {fansLoading ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--fm-text-sub)', fontSize: 13 }}>読み込み中...</div>
        ) : fans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--fm-text-muted)', fontSize: 13 }}>
            まだフォローしている人がいません
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {fans.map(fan => (
              <div key={fan.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 70,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', overflow: 'hidden',
                  background: 'var(--fm-bg-secondary)', border: '2px solid var(--fm-border)',
                }}>
                  {fan.person_image ? (
                    <img src={`${TMDB_IMG}/w185${fan.person_image}`} alt={fan.person_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 20, color: 'var(--fm-text-muted)',
                    }}>
                      {fan.person_type === 'director' ? '\uD83C\uDFAC' : '\uD83C\uDFAD'}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 10, color: 'var(--fm-text-sub)', textAlign: 'center',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
                }}>
                  {fan.person_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Earned Titles */}
      <div style={{
        background: 'var(--fm-bg-card)', borderRadius: 16, padding: 16,
        border: '1px solid var(--fm-border)', marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 12px' }}>
          獲得した称号
        </h3>
        {titlesLoading ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--fm-text-sub)', fontSize: 13 }}>読み込み中...</div>
        ) : titles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--fm-text-muted)', fontSize: 13 }}>
            まだ称号がありません
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {titles.map(t => {
              const rarityColor = t.title_rarity === 'legendary' ? '#ff4444'
                : t.title_rarity === 'epic' ? '#9c27b0'
                : t.title_rarity === 'rare' ? '#3498db'
                : 'var(--fm-text-sub)'
              return (
                <div key={t.id} title={t.title_description || ''}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '6px 12px', borderRadius: 20,
                    background: `${rarityColor}15`, border: `1px solid ${rarityColor}40`,
                  }}>
                  <span style={{ fontSize: 14 }}>{t.title_icon || '\uD83C\uDFC5'}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: rarityColor }}>
                    {t.title_name}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Settings & Logout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setShowSettings(true)}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: '1px solid var(--fm-border)',
            background: 'var(--fm-bg-card)', color: 'var(--fm-text)', fontSize: 14,
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}>
          {'\u2699\uFE0F'} 設定
        </button>
        <button onClick={onLogout}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: '1px solid var(--fm-danger)',
            background: 'transparent', color: 'var(--fm-danger)', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
          }}>
          ログアウト
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* My Lists Section (inline in Profile)                                */
/* ------------------------------------------------------------------ */

interface MyList {
  id: string
  title: string
  items_count: number
  is_public: boolean
  posters: string[]
}

function MyListsSection({ userId }: { userId: string }) {
  const [lists, setLists] = useState<MyList[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('user_lists')
        .select('id, title, items_count, is_public')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(6)

      const items = (data || []) as unknown as MyList[]

      // Fetch posters for each list
      if (items.length > 0) {
        const listIds = items.map(i => i.id)
        const { data: listItemsData } = await supabase
          .from('list_items')
          .select('list_id, movie_id')
          .in('list_id', listIds)
          .order('position', { ascending: true })

        if (listItemsData) {
          const listMovieMap = new Map<string, number[]>()
          for (const li of listItemsData as unknown as { list_id: string; movie_id: number }[]) {
            const existing = listMovieMap.get(li.list_id) || []
            if (existing.length < 4) {
              existing.push(li.movie_id)
              listMovieMap.set(li.list_id, existing)
            }
          }

          const allMovieIds = [...new Set([...listMovieMap.values()].flat())]
          if (allMovieIds.length > 0) {
            const { data: movieData } = await supabase
              .from('movies')
              .select('tmdb_id, poster_path')
              .in('tmdb_id', allMovieIds)
            const posterMap = new Map<number, string | null>()
            if (movieData) {
              for (const m of movieData as unknown as { tmdb_id: number; poster_path: string | null }[]) {
                posterMap.set(m.tmdb_id, m.poster_path)
              }
            }
            for (const item of items) {
              item.posters = (listMovieMap.get(item.id) || [])
                .map(mid => posterMap.get(mid))
                .filter((p): p is string => p != null)
            }
          }
        }
      }

      setLists(items)
      setLoading(false)
    }
    fetch()
  }, [userId])

  if (loading) {
    return (
      <div style={{
        background: 'var(--fm-bg-card)', borderRadius: 16, padding: 16,
        border: '1px solid var(--fm-border)', marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 12px' }}>Lists</h3>
        <div style={{ color: 'var(--fm-text-sub)', fontSize: 13, textAlign: 'center', padding: 16 }}>読み込み中...</div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--fm-bg-card)', borderRadius: 16, padding: 16,
      border: '1px solid var(--fm-border)', marginBottom: 16,
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fm-text)', margin: '0 0 12px' }}>
        Lists
      </h3>
      {lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--fm-text-muted)', fontSize: 13 }}>
          まだリストがありません
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lists.map(list => (
            <div key={list.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px',
              borderRadius: 8, background: 'var(--fm-bg-secondary)',
            }}>
              {/* Mini poster strip */}
              <div style={{ display: 'flex', flexShrink: 0, gap: 1 }}>
                {list.posters.length > 0 ? (
                  list.posters.slice(0, 3).map((poster, i) => (
                    <img key={i} src={`${TMDB_IMG_POSTER}${poster}`} alt=""
                      style={{ width: 24, height: 36, borderRadius: 2, objectFit: 'cover' }} loading="lazy" />
                  ))
                ) : (
                  <div style={{ width: 24, height: 36, borderRadius: 2, background: 'var(--fm-bg-hover)' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {list.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                  {list.items_count} films{!list.is_public && ' · Private'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
