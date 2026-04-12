'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { addPoints, POINT_CONFIG } from '../lib/points'
import { showToast } from '../lib/toast'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

// ── Types ──────────────────────────────────────────────────────────────────

interface WorkDetailProps {
  workId: number
  workType: 'movie' | 'tv'
  userId: string
  onClose: () => void
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}

interface Genre { id: number; name: string }
interface CastMember {
  id: number; name: string; character: string; profile_path: string | null; order: number
}
interface CrewMember {
  id: number; name: string; job: string; department: string; profile_path: string | null
}
interface Season {
  id: number; season_number: number; name: string; episode_count: number;
  poster_path: string | null; air_date: string | null; overview: string
}
interface Episode {
  id: number; episode_number: number; name: string; overview: string;
  air_date: string | null; still_path: string | null; runtime: number | null
}
interface Provider {
  provider_id: number; provider_name: string; logo_path: string
}
interface WatchProviders {
  flatrate?: Provider[]; rent?: Provider[]; buy?: Provider[]; link?: string
}
interface SimilarWork {
  id: number; title?: string; name?: string; poster_path: string | null;
  vote_average: number; media_type?: string; release_date?: string; first_air_date?: string
}
interface WatchlistEntry {
  id: string; user_id: string; movie_id: number; status: string; score: number | null;
  watched_date: string | null; watch_method: string | null; work_type: string
}
interface ReviewEntry {
  id: string; user_id: string; movie_id: number; body: string | null; score: number | null;
  is_spoiler: boolean; is_draft: boolean; created_at: string; updated_at: string
}
interface ReviewWithUser extends ReviewEntry {
  users: { display_name: string; avatar_url: string | null } | null
  likes_count: number
  liked_by_me: boolean
}
interface Video {
  id: string; key: string; name: string; site: string; type: string; official: boolean
}
interface ProductionCompany {
  id: number; name: string; logo_path: string | null; origin_country: string
}
interface TMDBDetail {
  id: number
  title?: string; name?: string; original_title?: string; original_name?: string
  overview: string; poster_path: string | null; backdrop_path: string | null
  release_date?: string; first_air_date?: string
  runtime?: number; episode_run_time?: number[]
  vote_average: number; vote_count: number
  genres: Genre[]
  credits?: { cast: CastMember[]; crew: CrewMember[] }
  similar?: { results: SimilarWork[] }
  recommendations?: { results: SimilarWork[] }
  'watch/providers'?: { results?: { JP?: WatchProviders } }
  videos?: { results: Video[] }
  seasons?: Season[]
  number_of_seasons?: number
  number_of_episodes?: number
  production_countries?: { iso_3166_1: string; name: string }[]
  production_companies?: ProductionCompany[]
  status?: string
  tagline?: string
  budget?: number
  revenue?: number
  spoken_languages?: { english_name: string; name: string; iso_639_1: string }[]
}

type SortMode = 'newest' | 'likes' | 'score_high' | 'score_low'
type WatchStatus = 'watched' | 'want_to_watch' | 'watching' | null

const WATCH_METHODS = ['映画館', '配信', 'DVD', 'TV', 'その他'] as const

// ── Helper Components ──────────────────────────────────────────────────────

function StarRating({
  value, onChange, size = 20, readonly = false,
}: {
  value: number; onChange?: (v: number) => void; size?: number; readonly?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value

  return (
    <span style={{ display: 'inline-flex', gap: 1, cursor: readonly ? 'default' : 'pointer' }}>
      {[1, 2, 3, 4, 5].map(star => {
        const full = display >= star
        const half = !full && display >= star - 0.5
        return (
          <span
            key={star}
            style={{ position: 'relative', width: size, height: size, fontSize: size }}
            onMouseLeave={() => !readonly && setHover(null)}
          >
            {/* left half */}
            <span
              style={{
                position: 'absolute', left: 0, top: 0, width: '50%', height: '100%',
                overflow: 'hidden', zIndex: 2,
              }}
              onMouseEnter={() => !readonly && setHover(star - 0.5)}
              onClick={() => !readonly && onChange?.(star - 0.5)}
            >
              <span style={{ color: (full || half) ? 'var(--fm-star)' : 'var(--fm-text-muted)' }}>★</span>
            </span>
            {/* right half */}
            <span
              style={{
                position: 'absolute', left: '50%', top: 0, width: '50%', height: '100%',
                overflow: 'hidden', zIndex: 2,
              }}
              onMouseEnter={() => !readonly && setHover(star)}
              onClick={() => !readonly && onChange?.(star)}
            >
              <span style={{ marginLeft: -(size / 2), color: full ? 'var(--fm-star)' : 'var(--fm-text-muted)' }}>★</span>
            </span>
            {/* background full star */}
            <span style={{
              position: 'absolute', left: 0, top: 0,
              color: full ? 'var(--fm-star)' : half ? 'var(--fm-text-muted)' : 'var(--fm-text-muted)',
            }}>★</span>
            {/* half star overlay */}
            {half && (
              <span style={{
                position: 'absolute', left: 0, top: 0, width: '50%', overflow: 'hidden',
                color: 'var(--fm-star)',
              }}>★</span>
            )}
          </span>
        )
      })}
    </span>
  )
}

function LoadingSpinner() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: 300, color: 'var(--fm-text-sub)',
    }}>
      <div style={{
        width: 36, height: 36, border: '3px solid var(--fm-border)',
        borderTopColor: 'var(--fm-accent)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function WorkDetail({ workId, workType, userId, onClose, onOpenWork }: WorkDetailProps) {
  // State: TMDB data
  const [detail, setDetail] = useState<TMDBDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State: User watchlist
  const [watchEntry, setWatchEntry] = useState<WatchlistEntry | null>(null)
  const [currentStatus, setCurrentStatus] = useState<WatchStatus>(null)
  const [score, setScore] = useState(0)
  const [watchedDate, setWatchedDate] = useState('')
  const [watchMethod, setWatchMethod] = useState('')
  const [savingWatchlist, setSavingWatchlist] = useState(false)

  // State: User review
  const [myReview, setMyReview] = useState<ReviewEntry | null>(null)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewSpoiler, setReviewSpoiler] = useState(false)
  const [reviewDraft, setReviewDraft] = useState(false)
  const [savingReview, setSavingReview] = useState(false)

  // State: Other reviews
  const [reviews, setReviews] = useState<ReviewWithUser[]>([])
  const [reviewSort, setReviewSort] = useState<SortMode>('newest')
  const [spoilerFilter, setSpoilerFilter] = useState<'all' | 'no_spoiler'>('all')
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set())

  // State: Cast fan
  const [fanIds, setFanIds] = useState<Set<number>>(new Set())

  // State: TV seasons/episodes
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null)
  const [seasonEpisodes, setSeasonEpisodes] = useState<Record<number, Episode[]>>({})
  const [episodeWatches, setEpisodeWatches] = useState<Set<string>>(new Set())
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null)

  // State: Providers
  const [providers, setProviders] = useState<WatchProviders | null>(null)

  // State: UI
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)
  const [showAllCast, setShowAllCast] = useState(false)
  const [showAllCrew, setShowAllCrew] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/tmdb?action=detail&id=${workId}&type=${workType}`)
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const data: TMDBDetail = await res.json()
      setDetail(data)

      // Extract providers
      const jp = data['watch/providers']?.results?.JP || null
      setProviders(jp)

      // Cache in movies table
      const title = data.title || data.name || ''
      const releaseDate = data.release_date || data.first_air_date || null
      await supabase.from('movies').upsert({
        tmdb_id: data.id,
        title,
        original_title: data.original_title || data.original_name || title,
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path,
        release_date: releaseDate,
        genres: data.genres,
        vote_average: data.vote_average,
        overview: data.overview,
        work_type: workType,
        production_countries: data.production_countries || [],
      }, { onConflict: 'tmdb_id' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [workId, workType])

  const fetchUserData = useCallback(async () => {
    // Watchlist entry
    const { data: wl } = await supabase
      .from('watchlists')
      .select('*')
      .eq('user_id', userId)
      .eq('movie_id', workId)
      .eq('work_type', workType)
      .maybeSingle()

    if (wl) {
      setWatchEntry(wl)
      setCurrentStatus(wl.status as WatchStatus)
      setScore(wl.score || 0)
      setWatchedDate(wl.watched_date || '')
      setWatchMethod(wl.watch_method || '')
    }

    // My review
    const { data: rv } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('movie_id', workId)
      .maybeSingle()

    if (rv) {
      setMyReview(rv)
      setReviewBody(rv.body || '')
      setReviewSpoiler(rv.is_spoiler || false)
      setReviewDraft(rv.is_draft || false)
    }

    // Fan IDs
    const { data: fans } = await supabase
      .from('fans')
      .select('person_id')
      .eq('user_id', userId)

    if (fans) {
      setFanIds(new Set(fans.map((f: { person_id: number }) => f.person_id)))
    }

    // Episode watches (TV)
    if (workType === 'tv') {
      const { data: ew } = await supabase
        .from('episode_watches')
        .select('episode_key')
        .eq('user_id', userId)
        .eq('work_id', workId)

      if (ew) {
        setEpisodeWatches(new Set(ew.map((e: { episode_key: string }) => e.episode_key)))
      }
    }
  }, [userId, workId, workType])

  const fetchReviews = useCallback(async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*, users(display_name, avatar_url)')
      .eq('movie_id', workId)
      .neq('user_id', userId)
      .eq('is_draft', false)

    if (!data) { setReviews([]); return }

    // Get likes counts and whether current user liked
    const reviewIds = data.map((r: ReviewEntry) => r.id)
    const { data: likes } = await supabase
      .from('likes')
      .select('review_id, user_id')
      .in('review_id', reviewIds.length > 0 ? reviewIds : ['__none__'])

    const likesMap: Record<string, number> = {}
    const myLikes = new Set<string>()
    likes?.forEach((l: { review_id: string; user_id: string }) => {
      likesMap[l.review_id] = (likesMap[l.review_id] || 0) + 1
      if (l.user_id === userId) myLikes.add(l.review_id)
    })

    const enriched: ReviewWithUser[] = data.map((r: ReviewEntry & { users: { display_name: string; avatar_url: string | null } | null }) => ({
      ...r,
      likes_count: likesMap[r.id] || 0,
      liked_by_me: myLikes.has(r.id),
    }))

    setReviews(enriched)
  }, [workId, userId])

  useEffect(() => {
    fetchDetail()
    fetchUserData()
    fetchReviews()
    scrollRef.current?.scrollTo(0, 0)
  }, [fetchDetail, fetchUserData, fetchReviews])

  // ── Watchlist Actions ────────────────────────────────────────────────────

  const handleStatusChange = async (status: WatchStatus) => {
    if (!status) return
    setSavingWatchlist(true)
    try {
      if (watchEntry) {
        await supabase
          .from('watchlists')
          .update({ status, score: score || null })
          .eq('id', watchEntry.id)
        setWatchEntry({ ...watchEntry, status })
      } else {
        const insertResult = await supabase
          .from('watchlists')
          .insert({
            user_id: userId, movie_id: workId, work_type: workType,
            status, score: score || null,
          })
        const { data } = await insertResult.select('*').single()
        if (data) setWatchEntry(data as unknown as WatchlistEntry)
      }
      setCurrentStatus(status)

      if (status === 'watched') {
        await addPoints(userId, POINT_CONFIG.WATCH_COMPLETE, '鑑賞完了')
        showToast('🎬 鑑賞済みにしました！ +' + POINT_CONFIG.WATCH_COMPLETE + 'pt')
      } else if (status === 'want_to_watch') {
        showToast('📌 観たいリストに追加しました')
      } else if (status === 'watching') {
        showToast('📺 視聴中にしました')
      }
    } catch {
      showToast('エラーが発生しました')
    } finally {
      setSavingWatchlist(false)
    }
  }

  const handleScoreChange = async (newScore: number) => {
    setScore(newScore)
    if (watchEntry) {
      await supabase
        .from('watchlists')
        .update({ score: newScore })
        .eq('id', watchEntry.id)
    }
  }

  const handleSaveWatchDetails = async () => {
    if (!watchEntry) return
    setSavingWatchlist(true)
    try {
      await supabase
        .from('watchlists')
        .update({
          watched_date: watchedDate || null,
          watch_method: watchMethod || null,
          score: score || null,
        })
        .eq('id', watchEntry.id)
      showToast('保存しました')
    } catch {
      showToast('保存に失敗しました')
    } finally {
      setSavingWatchlist(false)
    }
  }

  // ── Review Actions ───────────────────────────────────────────────────────

  const handleSaveReview = async (isDraft: boolean) => {
    setSavingReview(true)
    try {
      const reviewData = {
        user_id: userId, movie_id: workId, body: reviewBody,
        score: score || null, is_spoiler: reviewSpoiler,
        is_draft: isDraft, work_type: workType,
      }

      if (myReview) {
        await supabase
          .from('reviews')
          .update({ ...reviewData, updated_at: new Date().toISOString() })
          .eq('id', myReview.id)
        setMyReview({ ...myReview, ...reviewData } as typeof myReview)
      } else {
        const insertResult = await supabase
          .from('reviews')
          .insert(reviewData)
        const { data } = await insertResult.select('*').single()
        if (data) setMyReview(data as unknown as ReviewEntry)
      }

      setReviewDraft(isDraft)

      if (!isDraft) {
        const pts = (reviewBody.length >= 100)
          ? POINT_CONFIG.REVIEW_LONG
          : POINT_CONFIG.REVIEW_SHORT
        await addPoints(userId, pts, 'レビュー投稿')
        showToast(`✍️ レビューを投稿しました！ +${pts}pt`)
      } else {
        showToast('下書きを保存しました')
      }
    } catch {
      showToast('レビューの保存に失敗しました')
    } finally {
      setSavingReview(false)
    }
  }

  // ── Like Action ──────────────────────────────────────────────────────────

  const handleLike = async (review: ReviewWithUser) => {
    if (review.liked_by_me) {
      // Unlike
      await supabase
        .from('likes')
        .delete()
        .eq('review_id', review.id)
        .eq('user_id', userId)
      setReviews(prev =>
        prev.map(r => r.id === review.id
          ? { ...r, liked_by_me: false, likes_count: r.likes_count - 1 }
          : r)
      )
    } else {
      // Like
      await supabase
        .from('likes')
        .insert({ review_id: review.id, user_id: userId })
      setReviews(prev =>
        prev.map(r => r.id === review.id
          ? { ...r, liked_by_me: true, likes_count: r.likes_count + 1 }
          : r)
      )
      // Award points to review author
      await addPoints(review.user_id, POINT_CONFIG.LIKE_RECEIVE, 'いいね受取')
      await addPoints(userId, POINT_CONFIG.LIKE_SEND, 'いいね送信')
    }
  }

  // ── Fan Action ───────────────────────────────────────────────────────────

  const handleToggleFan = async (personId: number, personName: string) => {
    if (fanIds.has(personId)) {
      await supabase
        .from('fans')
        .delete()
        .eq('user_id', userId)
        .eq('person_id', personId)
      setFanIds(prev => { const n = new Set(prev); n.delete(personId); return n })
      showToast(`${personName} のファンを解除しました`)
    } else {
      await supabase
        .from('fans')
        .insert({ user_id: userId, person_id: personId, person_name: personName })
      setFanIds(prev => new Set(prev).add(personId))
      showToast(`${personName} のファンになりました！`)
    }
  }

  // ── TV Season/Episode ────────────────────────────────────────────────────

  const handleExpandSeason = async (seasonNumber: number) => {
    if (expandedSeason === seasonNumber) {
      setExpandedSeason(null)
      return
    }
    setExpandedSeason(seasonNumber)
    if (seasonEpisodes[seasonNumber]) return

    setLoadingSeason(seasonNumber)
    try {
      const res = await fetch(
        `/api/tmdb?action=season&id=${workId}&season=${seasonNumber}`
      )
      if (res.ok) {
        const data = await res.json()
        setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: data.episodes || [] }))
      }
    } catch {
      showToast('シーズン情報の取得に失敗しました')
    } finally {
      setLoadingSeason(null)
    }
  }

  const handleToggleEpisode = async (seasonNumber: number, episodeNumber: number) => {
    const key = `s${seasonNumber}e${episodeNumber}`
    if (episodeWatches.has(key)) {
      await supabase
        .from('episode_watches')
        .delete()
        .eq('user_id', userId)
        .eq('work_id', workId)
        .eq('episode_key', key)
      setEpisodeWatches(prev => { const n = new Set(prev); n.delete(key); return n })
    } else {
      await supabase
        .from('episode_watches')
        .insert({ user_id: userId, work_id: workId, episode_key: key })
      setEpisodeWatches(prev => new Set(prev).add(key))
    }
  }

  // ── Sorted/Filtered Reviews ──────────────────────────────────────────────

  const sortedReviews = [...reviews]
    .filter(r => spoilerFilter === 'all' || !r.is_spoiler)
    .sort((a, b) => {
      switch (reviewSort) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'likes': return b.likes_count - a.likes_count
        case 'score_high': return (b.score || 0) - (a.score || 0)
        case 'score_low': return (a.score || 0) - (b.score || 0)
        default: return 0
      }
    })

  // ── Derived data ─────────────────────────────────────────────────────────

  const title = detail?.title || detail?.name || ''
  const originalTitle = detail?.original_title || detail?.original_name || ''
  const year = (detail?.release_date || detail?.first_air_date || '').slice(0, 4)
  const releaseDate = detail?.release_date || detail?.first_air_date || ''
  const runtime = detail?.runtime || (detail?.episode_run_time?.[0]) || null
  const director = detail?.credits?.crew?.find(c => c.job === 'Director') || null
  const directors = detail?.credits?.crew?.filter(c => c.job === 'Director') || []
  const writers = detail?.credits?.crew?.filter(c =>
    c.job === 'Screenplay' || c.job === 'Writer' || c.job === 'Story'
  ).slice(0, 5) || []
  const composers = detail?.credits?.crew?.filter(c => c.job === 'Original Music Composer' || c.job === 'Music').slice(0, 3) || []
  const cinematographers = detail?.credits?.crew?.filter(c => c.job === 'Director of Photography').slice(0, 3) || []
  const editors = detail?.credits?.crew?.filter(c => c.job === 'Editor').slice(0, 3) || []
  const cast = detail?.credits?.cast?.slice(0, 20) || []
  const similar = detail?.recommendations?.results?.slice(0, 15) ||
    detail?.similar?.results?.slice(0, 15) || []
  const trailer = detail?.videos?.results?.find(v =>
    v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser') && v.official
  ) || detail?.videos?.results?.find(v =>
    v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  ) || null
  const countries = detail?.production_countries || []
  const companies = detail?.production_companies || []
  const budget = detail?.budget || 0
  const revenue = detail?.revenue || 0

  // ── Styles ───────────────────────────────────────────────────────────────

  const s = {
    container: {
      position: 'fixed' as const, inset: 0, zIndex: 1000,
      background: 'var(--fm-bg)', overflowY: 'auto' as const,
    },
    backdrop: {
      position: 'relative' as const, width: '100%', height: 320,
      backgroundSize: 'cover', backgroundPosition: 'center top',
      backgroundImage: detail?.backdrop_path
        ? `url(${TMDB_IMG}/w1280${detail.backdrop_path})`
        : 'linear-gradient(135deg, var(--fm-accent-dark), var(--fm-bg))',
    },
    backdropGradient: {
      position: 'absolute' as const, inset: 0,
      background: 'linear-gradient(to top, var(--fm-bg) 0%, rgba(10,11,20,0.6) 50%, rgba(10,11,20,0.3) 100%)',
    },
    backBtn: {
      position: 'absolute' as const, top: 12, left: 12, zIndex: 10,
      background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
      width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)',
    },
    heroRow: {
      display: 'flex', gap: 16, padding: '0 16px',
      marginTop: -100, position: 'relative' as const, zIndex: 5,
    },
    poster: {
      width: 130, minWidth: 130, height: 195, borderRadius: 8,
      objectFit: 'cover' as const, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      background: 'var(--fm-bg-card)',
    },
    heroInfo: {
      flex: 1, paddingTop: 60,
    },
    title: {
      fontSize: 22, fontWeight: 700, color: 'var(--fm-text)',
      lineHeight: 1.3, margin: 0,
    },
    originalTitle: {
      fontSize: 13, color: 'var(--fm-text-sub)', marginTop: 2,
    },
    meta: {
      display: 'flex', flexWrap: 'wrap' as const, gap: 8,
      marginTop: 8, alignItems: 'center',
    },
    metaText: {
      fontSize: 13, color: 'var(--fm-text-sub)',
    },
    genreBadge: {
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      background: 'var(--fm-bg-hover)', color: 'var(--fm-text-sub)',
      fontSize: 12, border: '1px solid var(--fm-border)',
    },
    section: {
      padding: '16px 16px 0',
    },
    sectionTitle: {
      fontSize: 16, fontWeight: 700, color: 'var(--fm-text)',
      marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
    },
    actionRow: {
      display: 'flex', gap: 8, flexWrap: 'wrap' as const,
      padding: '16px', alignItems: 'center',
    },
    actionBtn: (active: boolean, color?: string) => ({
      padding: '8px 16px', borderRadius: 20,
      border: active ? 'none' : '1px solid var(--fm-border)',
      background: active ? (color || 'var(--fm-accent)') : 'var(--fm-bg-card)',
      color: active ? '#fff' : 'var(--fm-text-sub)',
      fontSize: 13, fontWeight: 600, cursor: 'pointer',
      transition: 'all 0.2s', minHeight: 40,
    }),
    hScroll: {
      display: 'flex', gap: 12, overflowX: 'auto' as const,
      paddingBottom: 8, scrollbarWidth: 'none' as const,
    },
    card: {
      background: 'var(--fm-bg-card)', borderRadius: 12,
      border: '1px solid var(--fm-border)', padding: 16,
      marginBottom: 12,
    },
    input: {
      width: '100%', padding: '10px 12px', borderRadius: 8,
      border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
      color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' as const,
      minHeight: 44,
    },
    textarea: {
      width: '100%', padding: '10px 12px', borderRadius: 8,
      border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
      color: 'var(--fm-text)', fontSize: 14, minHeight: 120,
      resize: 'vertical' as const, boxSizing: 'border-box' as const,
      fontFamily: 'inherit', lineHeight: 1.6,
    },
    smallBtn: {
      padding: '6px 14px', borderRadius: 8, border: '1px solid var(--fm-border)',
      background: 'var(--fm-bg-card)', color: 'var(--fm-text-sub)',
      fontSize: 12, cursor: 'pointer', minHeight: 36,
    },
    primaryBtn: {
      padding: '8px 20px', borderRadius: 8, border: 'none',
      background: 'var(--fm-accent)', color: '#fff',
      fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44,
    },
    dangerBtn: {
      padding: '6px 14px', borderRadius: 8, border: 'none',
      background: 'var(--fm-danger)', color: '#fff',
      fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 36,
    },
    tabRow: {
      display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' as const,
    },
    tab: (active: boolean) => ({
      padding: '6px 12px', borderRadius: 16, border: 'none',
      background: active ? 'var(--fm-accent)' : 'var(--fm-bg-hover)',
      color: active ? '#fff' : 'var(--fm-text-sub)',
      fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 400,
      minHeight: 32,
    }),
    providerLogo: {
      width: 44, height: 44, borderRadius: 8, objectFit: 'cover' as const,
    },
    personCard: {
      textAlign: 'center' as const, width: 90, flexShrink: 0, cursor: 'pointer',
    },
    personImg: {
      width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' as const,
      background: 'var(--fm-bg-hover)',
    },
    progressBar: {
      width: '100%', height: 6, borderRadius: 3,
      background: 'var(--fm-bg-hover)', overflow: 'hidden',
    },
    progressFill: (pct: number) => ({
      height: '100%', borderRadius: 3,
      background: pct >= 100 ? 'var(--fm-success)' : 'var(--fm-accent)',
      width: `${Math.min(pct, 100)}%`, transition: 'width 0.3s',
    }),
    voteAvg: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 14, fontWeight: 700,
    },
    similarCard: {
      width: 120, flexShrink: 0, cursor: 'pointer',
    },
    similarPoster: {
      width: 120, height: 170, borderRadius: 8,
      objectFit: 'cover' as const, background: 'var(--fm-bg-card)',
    },
    episodeRow: {
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
      borderBottom: '1px solid var(--fm-border)',
    },
    checkmark: (checked: boolean) => ({
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      border: checked ? 'none' : '2px solid var(--fm-border)',
      background: checked ? 'var(--fm-success)' : 'transparent',
      color: '#fff', display: 'flex', alignItems: 'center',
      justifyContent: 'center', cursor: 'pointer', fontSize: 14,
    }),
    reviewCard: {
      background: 'var(--fm-bg-card)', borderRadius: 12,
      border: '1px solid var(--fm-border)', padding: 16, marginBottom: 12,
    },
    avatar: {
      width: 36, height: 36, borderRadius: '50%',
      objectFit: 'cover' as const, background: 'var(--fm-bg-hover)',
    },
    likeBtn: (active: boolean) => ({
      display: 'inline-flex', alignItems: 'center', gap: 4,
      border: 'none', background: 'none', cursor: 'pointer',
      color: active ? 'var(--fm-danger)' : 'var(--fm-text-muted)',
      fontSize: 14, padding: 4, minHeight: 32,
    }),
    fanBtn: (active: boolean) => ({
      padding: '4px 10px', borderRadius: 12, fontSize: 11,
      border: active ? 'none' : '1px solid var(--fm-accent)',
      background: active ? 'var(--fm-accent)' : 'transparent',
      color: active ? '#fff' : 'var(--fm-accent)', cursor: 'pointer',
      fontWeight: 600, minHeight: 28,
    }),
    tagline: {
      fontSize: 14, color: 'var(--fm-text-sub)', fontStyle: 'italic' as const,
      marginTop: 8,
    },
    overview: {
      fontSize: 14, color: 'var(--fm-text-sub)', lineHeight: 1.7,
    },
    scoreBox: {
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '16px', background: 'var(--fm-bg-card)', borderRadius: 12,
      border: '1px solid var(--fm-border)', margin: '0 16px',
    },
    bigScore: {
      fontSize: 40, fontWeight: 800, lineHeight: 1,
    },
    histogramRow: {
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
    },
    histogramBar: {
      flex: 1, height: 8, borderRadius: 4, background: 'var(--fm-bg-hover)', overflow: 'hidden',
    },
    histogramFill: (pct: number) => ({
      height: '100%', borderRadius: 4,
      background: 'linear-gradient(90deg, var(--fm-accent), var(--fm-accent-light))',
      width: `${pct}%`, transition: 'width 0.5s ease',
    }),
    infoGrid: {
      display: 'grid', gridTemplateColumns: '80px 1fr',
      gap: '8px 12px', fontSize: 13,
    },
    infoLabel: {
      color: 'var(--fm-text-muted)', fontWeight: 500,
    },
    infoValue: {
      color: 'var(--fm-text)', fontWeight: 400,
    },
    trailerWrap: {
      position: 'relative' as const, width: '100%', paddingBottom: '56.25%',
      borderRadius: 12, overflow: 'hidden', background: '#000',
    },
    trailerIframe: {
      position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', border: 'none',
    },
    crewRow: {
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: '1px solid var(--fm-border)',
    },
    shareBtn: {
      position: 'absolute' as const, top: 12, right: 12, zIndex: 10,
      background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
      width: 40, height: 40, color: '#fff', fontSize: 18, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)',
    },
    companyLogo: {
      height: 24, maxWidth: 80, objectFit: 'contain' as const,
      filter: 'brightness(0) invert(1)', opacity: 0.7,
    },
    watchMethodBtn: (active: boolean) => ({
      padding: '6px 14px', borderRadius: 16,
      border: active ? 'none' : '1px solid var(--fm-border)',
      background: active ? 'var(--fm-accent)' : 'var(--fm-bg-card)',
      color: active ? '#fff' : 'var(--fm-text-sub)',
      fontSize: 12, cursor: 'pointer', minHeight: 32,
    }),
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={s.container} ref={scrollRef}>
        <button style={{ ...s.backBtn, position: 'fixed' }} onClick={onClose}>←</button>
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div style={s.container} ref={scrollRef}>
        <button style={{ ...s.backBtn, position: 'fixed' }} onClick={onClose}>←</button>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 300, gap: 16, padding: 32,
        }}>
          <span style={{ fontSize: 40 }}>⚠️</span>
          <p style={{ color: 'var(--fm-danger)', fontSize: 15 }}>
            {error || 'データの取得に失敗しました'}
          </p>
          <button style={s.primaryBtn} onClick={fetchDetail}>再読み込み</button>
        </div>
      </div>
    )
  }

  const voteColor = detail.vote_average >= 7 ? 'var(--fm-success)'
    : detail.vote_average >= 5 ? 'var(--fm-warning)' : 'var(--fm-danger)'

  return (
    <div style={s.container} ref={scrollRef} className="animate-fade-in">
      {/* ── 1. Header / Backdrop ── */}
      <div style={s.backdrop}>
        <div style={s.backdropGradient} />
        <button style={s.backBtn} onClick={onClose} aria-label="戻る">←</button>
        <button
          style={s.shareBtn}
          onClick={() => {
            const url = `${window.location.origin}?work=${workId}&type=${workType}`
            if (navigator.share) {
              navigator.share({ title: `${title} - Filmo`, url })
            } else {
              navigator.clipboard.writeText(url)
              showToast('リンクをコピーしました')
            }
          }}
          aria-label="共有"
        >↗</button>
      </div>

      {/* Hero row: poster + title */}
      <div style={s.heroRow}>
        {detail.poster_path ? (
          <img
            src={`${TMDB_IMG}/w342${detail.poster_path}`}
            alt={title}
            style={s.poster}
          />
        ) : (
          <div style={{
            ...s.poster, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 40, color: 'var(--fm-text-muted)',
          }}>🎬</div>
        )}
        <div style={s.heroInfo}>
          <h1 style={s.title}>{title}</h1>
          {originalTitle && originalTitle !== title && (
            <div style={s.originalTitle}>{originalTitle}</div>
          )}
          {detail.tagline && (
            <p style={s.tagline}>「{detail.tagline}」</p>
          )}
          <div style={s.meta}>
            {releaseDate && <span style={s.metaText}>{releaseDate.replace(/-/g, '/')}</span>}
            {runtime && <span style={s.metaText}>{runtime}分</span>}
            {countries.length > 0 && (
              <span style={s.metaText}>{countries.map(c => c.name).join(' / ')}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {detail.genres.map(g => (
              <span key={g.id} style={s.genreBadge}>{g.name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Score Display (Filmarks-style) ── */}
      <div style={{ ...s.scoreBox, marginTop: 16 }}>
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{ ...s.bigScore, color: voteColor }}>
            {(detail.vote_average / 2).toFixed(1)}
          </div>
          <StarRating value={detail.vote_average / 2} size={14} readonly />
          <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 4 }}>
            TMDB {detail.vote_average.toFixed(1)}/10
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {/* Score distribution histogram (simulated from TMDB average) */}
          {(() => {
            const avg = detail.vote_average / 2
            const buckets = [
              { label: '4-5', pct: avg >= 4 ? 60 : avg >= 3 ? 30 : 10 },
              { label: '3-4', pct: avg >= 3 && avg < 4 ? 50 : avg >= 4 ? 25 : 20 },
              { label: '2-3', pct: avg >= 2 && avg < 3 ? 45 : 15 },
              { label: '1-2', pct: avg < 2 ? 40 : 5 },
            ]
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {buckets.map(b => (
                  <div key={b.label} style={s.histogramRow}>
                    <span style={{ width: 24, textAlign: 'right', color: 'var(--fm-text-muted)' }}>
                      {b.label}
                    </span>
                    <div style={s.histogramBar}>
                      <div style={s.histogramFill(b.pct)} />
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', textAlign: 'right', marginTop: 2 }}>
                  {detail.vote_count.toLocaleString()}件の評価
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── 3. Action Buttons ── */}
      <div style={s.actionRow}>
        <button
          style={s.actionBtn(currentStatus === 'watched', 'var(--fm-success)')}
          onClick={() => handleStatusChange('watched')}
          disabled={savingWatchlist}
        >
          ✓ Mark!（鑑賞済み）
        </button>
        <button
          style={s.actionBtn(currentStatus === 'want_to_watch')}
          onClick={() => handleStatusChange('want_to_watch')}
          disabled={savingWatchlist}
        >
          📌 Clip!（観たい）
        </button>
        {workType === 'tv' && (
          <button
            style={s.actionBtn(currentStatus === 'watching', 'var(--fm-warning)')}
            onClick={() => handleStatusChange('watching')}
            disabled={savingWatchlist}
          >
            📺 観てる中
          </button>
        )}
      </div>

      {/* Star rating */}
      <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>あなたの評価:</span>
        <StarRating value={score} onChange={handleScoreChange} size={28} />
        {score > 0 && (
          <span style={{ fontSize: 14, color: 'var(--fm-star)', fontWeight: 700 }}>
            {score.toFixed(1)}
          </span>
        )}
      </div>

      {/* ── 4. Watchlist Entry Details ── */}
      {currentStatus && (
        <div style={{ ...s.section }}>
          <div style={s.card}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4, display: 'block' }}>
                  鑑賞日
                </label>
                <input
                  type="date"
                  value={watchedDate}
                  onChange={e => setWatchedDate(e.target.value)}
                  style={s.input}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4, display: 'block' }}>
                  視聴方法
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {WATCH_METHODS.map(method => (
                    <button
                      key={method}
                      style={s.watchMethodBtn(watchMethod === method)}
                      onClick={() => setWatchMethod(watchMethod === method ? '' : method)}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              <button
                style={s.primaryBtn}
                onClick={handleSaveWatchDetails}
                disabled={savingWatchlist}
              >
                {savingWatchlist ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Streaming / Watch Providers (moved up like Filmarks) ── */}
      {providers && (providers.flatrate?.length || providers.rent?.length || providers.buy?.length) && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>📺 配信・視聴情報</h3>
          <div style={s.card}>
            {providers.flatrate && providers.flatrate.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-success)', marginBottom: 8 }}>
                  ● 見放題
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {providers.flatrate.map(p => (
                    <div key={p.provider_id} style={{ textAlign: 'center' }}>
                      <img src={`${TMDB_IMG}/w92${p.logo_path}`} alt={p.provider_name}
                        style={s.providerLogo} title={p.provider_name} />
                      <div style={{ fontSize: 10, color: 'var(--fm-text-muted)', marginTop: 4 }}>{p.provider_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {providers.rent && providers.rent.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-warning)', marginBottom: 8 }}>
                  ● レンタル
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {providers.rent.map(p => (
                    <div key={p.provider_id} style={{ textAlign: 'center' }}>
                      <img src={`${TMDB_IMG}/w92${p.logo_path}`} alt={p.provider_name}
                        style={s.providerLogo} title={p.provider_name} />
                      <div style={{ fontSize: 10, color: 'var(--fm-text-muted)', marginTop: 4 }}>{p.provider_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {providers.buy && providers.buy.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-accent)', marginBottom: 8 }}>
                  ● 購入
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {providers.buy.map(p => (
                    <div key={p.provider_id} style={{ textAlign: 'center' }}>
                      <img src={`${TMDB_IMG}/w92${p.logo_path}`} alt={p.provider_name}
                        style={s.providerLogo} title={p.provider_name} />
                      <div style={{ fontSize: 10, color: 'var(--fm-text-muted)', marginTop: 4 }}>{p.provider_name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {providers.link && (
              <a href={providers.link} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: 12, padding: '8px 16px', borderRadius: 8,
                  background: 'var(--fm-bg-hover)', color: 'var(--fm-accent)', fontSize: 13,
                  textDecoration: 'none', fontWeight: 600 }}>
                詳細を見る →
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── 6. Overview (with expand/collapse) ── */}
      {detail.overview && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>あらすじ</h3>
          <div style={{ position: 'relative' }}>
            <p style={{
              ...s.overview,
              maxHeight: synopsisExpanded ? 'none' : 120,
              overflow: 'hidden',
            }}>
              {detail.overview}
            </p>
            {detail.overview.length > 200 && !synopsisExpanded && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 48,
                background: 'linear-gradient(transparent, var(--fm-bg))',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              }}>
                <button
                  onClick={() => setSynopsisExpanded(true)}
                  style={{
                    background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
                    color: 'var(--fm-accent)', padding: '4px 16px', borderRadius: 12,
                    fontSize: 12, cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  続きを読む
                </button>
              </div>
            )}
            {synopsisExpanded && detail.overview.length > 200 && (
              <button
                onClick={() => setSynopsisExpanded(false)}
                style={{
                  background: 'none', border: 'none', color: 'var(--fm-text-muted)',
                  fontSize: 12, cursor: 'pointer', marginTop: 4, padding: 0,
                }}
              >
                閉じる
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 7. Trailer (Filmarks にもある) ── */}
      {trailer && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>🎥 予告編</h3>
          <div style={s.trailerWrap}>
            <iframe
              src={`https://www.youtube.com/embed/${trailer.key}?rel=0`}
              title={trailer.name}
              style={s.trailerIframe}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--fm-text-muted)', marginTop: 6 }}>
            {trailer.name}
          </div>
        </div>
      )}

      {/* ── 8. Production Info (Filmarksにない - Filmo独自) ── */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>🎬 作品情報</h3>
        <div style={s.card}>
          <div style={s.infoGrid}>
            {releaseDate && (
              <>
                <span style={s.infoLabel}>公開日</span>
                <span style={s.infoValue}>{releaseDate.replace(/-/g, '/')}</span>
              </>
            )}
            {runtime && (
              <>
                <span style={s.infoLabel}>上映時間</span>
                <span style={s.infoValue}>{Math.floor(runtime / 60)}時間{runtime % 60}分 ({runtime}分)</span>
              </>
            )}
            {countries.length > 0 && (
              <>
                <span style={s.infoLabel}>製作国</span>
                <span style={s.infoValue}>{countries.map(c => c.name).join(' / ')}</span>
              </>
            )}
            {directors.length > 0 && (
              <>
                <span style={s.infoLabel}>監督</span>
                <span style={s.infoValue}>{directors.map(d => d.name).join('、')}</span>
              </>
            )}
            {writers.length > 0 && (
              <>
                <span style={s.infoLabel}>脚本</span>
                <span style={s.infoValue}>{writers.map(w => w.name).join('、')}</span>
              </>
            )}
            {composers.length > 0 && (
              <>
                <span style={s.infoLabel}>音楽</span>
                <span style={s.infoValue}>{composers.map(c => c.name).join('、')}</span>
              </>
            )}
            {cinematographers.length > 0 && (
              <>
                <span style={s.infoLabel}>撮影</span>
                <span style={s.infoValue}>{cinematographers.map(c => c.name).join('、')}</span>
              </>
            )}
            {editors.length > 0 && (
              <>
                <span style={s.infoLabel}>編集</span>
                <span style={s.infoValue}>{editors.map(e => e.name).join('、')}</span>
              </>
            )}
            {detail.status && (
              <>
                <span style={s.infoLabel}>ステータス</span>
                <span style={s.infoValue}>{
                  detail.status === 'Released' ? '公開済み'
                    : detail.status === 'Post Production' ? 'ポストプロダクション'
                    : detail.status === 'In Production' ? '制作中'
                    : detail.status === 'Planned' ? '企画中'
                    : detail.status === 'Returning Series' ? '放送中'
                    : detail.status === 'Ended' ? '終了'
                    : detail.status
                }</span>
              </>
            )}
            {budget > 0 && (
              <>
                <span style={s.infoLabel}>製作費</span>
                <span style={s.infoValue}>${(budget / 1_000_000).toFixed(0)}M（約{Math.round(budget * 150 / 100_000_000)}億円）</span>
              </>
            )}
            {revenue > 0 && (
              <>
                <span style={s.infoLabel}>興行収入</span>
                <span style={s.infoValue}>${(revenue / 1_000_000).toFixed(0)}M（約{Math.round(revenue * 150 / 100_000_000)}億円）</span>
              </>
            )}
            {budget > 0 && revenue > 0 && (
              <>
                <span style={s.infoLabel}>収益率</span>
                <span style={{
                  ...s.infoValue,
                  color: revenue > budget ? 'var(--fm-success)' : 'var(--fm-danger)',
                  fontWeight: 600,
                }}>
                  {((revenue / budget) * 100).toFixed(0)}%
                  {revenue > budget ? ' 🎉' : ''}
                </span>
              </>
            )}
          </div>

          {/* Production companies */}
          {companies.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--fm-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--fm-text-muted)', marginBottom: 8, fontWeight: 500 }}>制作会社</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                {companies.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.logo_path ? (
                      <img src={`${TMDB_IMG}/w92${c.logo_path}`} alt={c.name}
                        style={s.companyLogo} />
                    ) : null}
                    <span style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Review Section ── */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>✍️ レビュー</h3>

        {/* My review editor */}
        <div style={s.card}>
          <textarea
            style={s.textarea}
            value={reviewBody}
            onChange={e => setReviewBody(e.target.value)}
            placeholder="この作品について書く..."
            maxLength={5000}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, color: 'var(--fm-text-sub)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={reviewSpoiler}
                  onChange={e => setReviewSpoiler(e.target.checked)}
                  style={{ accentColor: 'var(--fm-danger)' }}
                />
                ネタバレあり
              </label>
              <span style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>
                {reviewBody.length} / 5000
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={s.smallBtn}
                onClick={() => handleSaveReview(true)}
                disabled={savingReview || !reviewBody.trim()}
              >
                下書き保存
              </button>
              <button
                style={{
                  ...s.primaryBtn,
                  opacity: (!reviewBody.trim() || savingReview) ? 0.5 : 1,
                }}
                onClick={() => handleSaveReview(false)}
                disabled={savingReview || !reviewBody.trim()}
              >
                {savingReview ? '投稿中...' : myReview && !myReview.is_draft ? '更新' : '投稿'}
              </button>
            </div>
          </div>
          {reviewDraft && myReview?.is_draft && (
            <div style={{
              marginTop: 8, padding: '6px 12px', borderRadius: 8,
              background: 'rgba(240,192,64,0.1)', border: '1px solid var(--fm-warning)',
              fontSize: 12, color: 'var(--fm-warning)',
            }}>
              下書き保存中
            </div>
          )}
        </div>

        {/* Reviews from others */}
        <div style={{ marginTop: 20 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8,
          }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', margin: 0 }}>
              みんなのレビュー ({reviews.length})
            </h4>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--fm-text-sub)', cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={spoilerFilter === 'no_spoiler'}
                onChange={e => setSpoilerFilter(e.target.checked ? 'no_spoiler' : 'all')}
              />
              ネタバレなしのみ
            </label>
          </div>

          {/* Sort tabs */}
          <div style={s.tabRow}>
            {([
              ['newest', '新着'],
              ['likes', 'いいね数'],
              ['score_high', 'スコア高い'],
              ['score_low', 'スコア低い'],
            ] as [SortMode, string][]).map(([key, label]) => (
              <button
                key={key}
                style={s.tab(reviewSort === key)}
                onClick={() => setReviewSort(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {sortedReviews.length === 0 ? (
            <p style={{ color: 'var(--fm-text-muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>
              まだレビューはありません
            </p>
          ) : (
            sortedReviews.map(review => (
              <div key={review.id} style={s.reviewCard}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                }}>
                  {review.users?.avatar_url ? (
                    <img src={review.users.avatar_url} alt="" style={s.avatar} />
                  ) : (
                    <div style={{
                      ...s.avatar, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)',
                    }}>👤</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>
                      {review.users?.display_name || '匿名ユーザー'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                      {new Date(review.created_at).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  {review.score && (
                    <StarRating value={review.score} size={16} readonly />
                  )}
                </div>

                {review.is_spoiler && !revealedSpoilers.has(review.id) ? (
                  <div
                    className="spoiler-text"
                    onClick={() => setRevealedSpoilers(prev => new Set(prev).add(review.id))}
                    style={{ padding: '8px 12px', fontSize: 14, lineHeight: 1.7 }}
                  >
                    {review.body}
                  </div>
                ) : review.is_spoiler ? (
                  <>
                    <div style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(255,107,107,0.15)', color: 'var(--fm-danger)',
                      fontSize: 11, fontWeight: 600, marginBottom: 6,
                    }}>
                      ⚠ ネタバレあり
                    </div>
                    <div
                      className="spoiler-text revealed"
                      style={{ padding: '4px 0', fontSize: 14, lineHeight: 1.7 }}
                    >
                      {review.body}
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 14, color: 'var(--fm-text)', lineHeight: 1.7, margin: 0 }}>
                    {review.body}
                  </p>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginTop: 10,
                }}>
                  <button
                    style={s.likeBtn(review.liked_by_me)}
                    onClick={() => handleLike(review)}
                  >
                    {review.liked_by_me ? '❤️' : '🤍'} {review.likes_count}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 9. Cast & Crew (Enhanced) ── */}
      {(cast.length > 0 || director) && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>👥 キャスト</h3>

          {/* Cast scroll */}
          <div style={s.hScroll}>
            {(showAllCast ? cast : cast.slice(0, 10)).map(person => (
              <div key={person.id} style={s.personCard}>
                {person.profile_path ? (
                  <img src={`${TMDB_IMG}/w185${person.profile_path}`} alt={person.name} style={s.personImg} />
                ) : (
                  <div style={{ ...s.personImg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--fm-text-muted)' }}>👤</div>
                )}
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fm-text)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {person.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {person.character}
                </div>
                <button style={s.fanBtn(fanIds.has(person.id))} onClick={() => handleToggleFan(person.id, person.name)}>
                  {fanIds.has(person.id) ? 'Fan! ✓' : 'Fan!'}
                </button>
              </div>
            ))}
          </div>
          {cast.length > 10 && (
            <button
              onClick={() => setShowAllCast(!showAllCast)}
              style={{ background: 'none', border: 'none', color: 'var(--fm-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 0' }}
            >
              {showAllCast ? '閉じる' : `すべてのキャスト (${cast.length}人) ›`}
            </button>
          )}

          {/* Crew section */}
          {(directors.length > 0 || writers.length > 0) && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', margin: '0 0 8px' }}>スタッフ</h4>
              <div style={s.card}>
                {/* Directors */}
                {directors.map(d => (
                  <div key={`dir-${d.id}`} style={s.crewRow}>
                    {d.profile_path ? (
                      <img src={`${TMDB_IMG}/w185${d.profile_path}`} alt={d.name}
                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fm-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)' }}>🎬</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>監督</div>
                    </div>
                    <button style={s.fanBtn(fanIds.has(d.id))} onClick={() => handleToggleFan(d.id, d.name)}>
                      {fanIds.has(d.id) ? 'Fan! ✓' : 'Fan!'}
                    </button>
                  </div>
                ))}
                {/* Writers */}
                {writers.map(w => (
                  <div key={`wr-${w.id}`} style={s.crewRow}>
                    {w.profile_path ? (
                      <img src={`${TMDB_IMG}/w185${w.profile_path}`} alt={w.name}
                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fm-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)' }}>✍️</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{w.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>脚本</div>
                    </div>
                    <button style={s.fanBtn(fanIds.has(w.id))} onClick={() => handleToggleFan(w.id, w.name)}>
                      {fanIds.has(w.id) ? 'Fan! ✓' : 'Fan!'}
                    </button>
                  </div>
                ))}
                {/* Show more crew (composers, cinematographers, editors) */}
                {showAllCrew && (
                  <>
                    {composers.map(c => (
                      <div key={`comp-${c.id}`} style={s.crewRow}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fm-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)' }}>🎵</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>音楽</div>
                        </div>
                      </div>
                    ))}
                    {cinematographers.map(c => (
                      <div key={`cin-${c.id}`} style={s.crewRow}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fm-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)' }}>📷</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>撮影</div>
                        </div>
                      </div>
                    ))}
                    {editors.map(e => (
                      <div key={`ed-${e.id}`} style={s.crewRow}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fm-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)' }}>✂️</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{e.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>編集</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {(composers.length > 0 || cinematographers.length > 0 || editors.length > 0) && (
                  <button
                    onClick={() => setShowAllCrew(!showAllCrew)}
                    style={{ background: 'none', border: 'none', color: 'var(--fm-accent)', fontSize: 12, cursor: 'pointer', padding: '8px 0', fontWeight: 600 }}
                  >
                    {showAllCrew ? '閉じる' : 'その他のスタッフを表示 ›'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 10. Similar / Recommendations ── */}
      {similar.length > 0 && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>🎯 おすすめ作品</h3>
          <div style={s.hScroll}>
            {similar.map(work => (
              <div
                key={work.id}
                style={s.similarCard}
                onClick={() => onOpenWork(
                  work.id,
                  work.media_type === 'tv' ? 'tv' : work.media_type === 'movie' ? 'movie' : workType,
                )}
              >
                {work.poster_path ? (
                  <img
                    src={`${TMDB_IMG}/w342${work.poster_path}`}
                    alt={work.title || work.name || ''}
                    style={s.similarPoster}
                  />
                ) : (
                  <div style={{
                    ...s.similarPoster, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 28, color: 'var(--fm-text-muted)',
                    border: '1px solid var(--fm-border)',
                  }}>🎬</div>
                )}
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--fm-text)',
                  marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {work.title || work.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                  {(work.release_date || work.first_air_date || '').slice(0, 4)}
                  {work.vote_average > 0 && ` ★${work.vote_average.toFixed(1)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 8. TV Seasons & Episodes ── */}
      {workType === 'tv' && detail.seasons && detail.seasons.length > 0 && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>
            シーズン
            {detail.number_of_seasons && (
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--fm-text-sub)' }}>
                ({detail.number_of_seasons}シーズン / {detail.number_of_episodes}話)
              </span>
            )}
          </h3>

          {detail.seasons
            .filter(s => s.season_number > 0) // Skip "specials" season 0
            .map(season => {
              const episodes = seasonEpisodes[season.season_number] || []
              const watchedCount = episodes.filter(
                ep => episodeWatches.has(`s${season.season_number}e${ep.episode_number}`)
              ).length
              const totalEps = episodes.length || season.episode_count
              const progress = totalEps > 0 ? (watchedCount / totalEps) * 100 : 0
              const isExpanded = expandedSeason === season.season_number
              const isLoading = loadingSeason === season.season_number

              return (
                <div
                  key={season.id}
                  style={{
                    ...s.card, padding: 0, overflow: 'hidden',
                    marginBottom: 8,
                  }}
                >
                  {/* Season header */}
                  <button
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      gap: 12, padding: '12px 16px', border: 'none',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      color: 'var(--fm-text)', minHeight: 44,
                    }}
                    onClick={() => handleExpandSeason(season.season_number)}
                  >
                    {season.poster_path ? (
                      <img
                        src={`${TMDB_IMG}/w92${season.poster_path}`}
                        alt={season.name}
                        style={{ width: 40, height: 56, borderRadius: 4, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: 40, height: 56, borderRadius: 4,
                        background: 'var(--fm-bg-hover)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, color: 'var(--fm-text-muted)',
                      }}>📺</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {season.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>
                        {season.episode_count}話
                        {season.air_date && ` / ${season.air_date.slice(0, 4)}`}
                      </div>
                      {episodes.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <div style={s.progressBar}>
                            <div style={s.progressFill(progress)} />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 2 }}>
                            {watchedCount}/{totalEps} 話視聴済み
                          </div>
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 16, color: 'var(--fm-text-muted)',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}>▼</span>
                  </button>

                  {/* Episodes list */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 12px' }}>
                      {isLoading ? (
                        <div style={{
                          textAlign: 'center', padding: 20,
                          color: 'var(--fm-text-muted)', fontSize: 13,
                        }}>読み込み中...</div>
                      ) : episodes.length === 0 ? (
                        <div style={{
                          textAlign: 'center', padding: 20,
                          color: 'var(--fm-text-muted)', fontSize: 13,
                        }}>エピソード情報がありません</div>
                      ) : (
                        episodes.map(ep => {
                          const key = `s${season.season_number}e${ep.episode_number}`
                          const watched = episodeWatches.has(key)
                          return (
                            <div key={ep.id} style={s.episodeRow}>
                              <div
                                style={s.checkmark(watched)}
                                onClick={() => handleToggleEpisode(season.season_number, ep.episode_number)}
                              >
                                {watched && '✓'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: 13, fontWeight: 500, color: 'var(--fm-text)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  <span style={{ color: 'var(--fm-text-muted)', marginRight: 6 }}>
                                    EP{ep.episode_number}
                                  </span>
                                  {ep.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                                  {ep.air_date && new Date(ep.air_date).toLocaleDateString('ja-JP')}
                                  {ep.runtime && ` / ${ep.runtime}分`}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {/* Bottom spacing */}
      <div style={{ height: 60 }} />
    </div>
  )
}
