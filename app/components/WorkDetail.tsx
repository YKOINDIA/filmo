'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { addPoints, POINT_CONFIG } from '../lib/points'
import { showToast } from '../lib/toast'
import { trackReviewPosted } from '../lib/analytics'
import { buildTasteProfile, calculateMatchScore, type TasteProfile } from '../lib/matchScore'
import VoiceReviewRecorder from './VoiceReviewRecorder'
import VoiceReviewPlayer from './VoiceReviewPlayer'
import ShareCard from './ShareCard'
import EditProposalModal from './EditProposalModal'
import ReportModal from './ReportModal'
import TranslateButton from './TranslateButton'
import { useLocale } from '../lib/i18n'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

// 音声レビュー機能(期待の声・感想の声)を有効にするか。
// Capacitor WebView × iOS で getUserMedia の動作が安定しないため、
// App Store 1.0 リリースでは無効化。1.1 で @capacitor-community/voice-recorder
// 等のネイティブプラグインに置き換えてから true に戻す。
// 既存の voice_reviews テーブル / Storage は残すので、後で再有効化したら復活する。
const VOICE_REVIEW_ENABLED = false

// ── Types ──────────────────────────────────────────────────────────────────

interface WorkDetailProps {
  workId: number
  workType: 'movie' | 'tv'
  userId: string
  onClose: () => void
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
  onOpenPerson?: (id: number) => void
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
  watched_at: string | null; watched_at_approx: string | null; watch_method: string | null;
  streaming_platform: string | null; memo: string | null
}
interface ClipMemoEntry {
  id: string; user_id: string; memo: string; score: number | null;
  users?: { name: string; avatar_url: string | null } | null
}
interface ReviewEntry {
  id: string; user_id: string; movie_id: number; body: string | null; score: number | null;
  has_spoiler: boolean; is_draft: boolean; created_at: string; updated_at: string
}
interface ReviewWithUser extends ReviewEntry {
  users: { name: string; avatar_url: string | null } | null
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
  data_source?: string  // 'tmdb' | 'annict' | 'user'
}

type SortMode = 'newest' | 'likes' | 'score_high' | 'score_low'
type WatchStatus = 'watched' | 'want_to_watch' | 'watching' | null

const WATCH_METHODS_MAP: Record<string, string> = {
  '映画館': 'theater',
  '配信': 'streaming',
  'DVD': 'dvd',
  'TV': 'tv',
  'その他': 'other',
}
const WATCH_METHODS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(WATCH_METHODS_MAP).map(([k, v]) => [v, k])
)
const WATCH_METHODS = ['映画館', '配信', 'DVD', 'TV', 'その他'] as const
const STREAMING_PLATFORMS = [
  'Netflix', 'Amazon Prime', 'Disney+', 'U-NEXT', 'Hulu',
  'Apple TV+', 'ABEMA', 'dアニメストア', 'Lemino', 'WOWOWオンデマンド', 'その他',
] as const

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

export default function WorkDetail({ workId, workType, userId, onClose, onOpenWork, onOpenPerson }: WorkDetailProps) {
  const { t, tmdbLang } = useLocale()
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
  const [watchedDateMode, setWatchedDateMode] = useState<'old' | 'recent' | 'exact' | ''>('')
  const [streamingPlatform, setStreamingPlatform] = useState('')
  const [clipMemo, setClipMemo] = useState('')
  const [clipMemos, setClipMemos] = useState<ClipMemoEntry[]>([])
  const [savingWatchlist, setSavingWatchlist] = useState(false)

  // State: User review
  const [myReview, setMyReview] = useState<ReviewEntry | null>(null)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewSpoiler, setReviewSpoiler] = useState(false)
  const [reviewDraft, setReviewDraft] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  // 保存後 5秒だけインラインで「✓ 投稿しました」を出してユーザーに保存完了を保証する。
  // toast が UI に隠れた場合の保険。
  const [reviewJustSaved, setReviewJustSaved] = useState<'posted' | 'draft' | 'failed' | null>(null)

  // State: Other reviews
  const [reviews, setReviews] = useState<ReviewWithUser[]>([])
  const [reviewSort, setReviewSort] = useState<SortMode>('newest')
  const [spoilerFilter, setSpoilerFilter] = useState<'all' | 'no_spoiler'>('all')
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set())
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set())
  const [openMenuReviewId, setOpenMenuReviewId] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<{ type: 'review' | 'user'; id: string; label?: string } | null>(null)

  // State: Voice reviews
  const [voiceReviews, setVoiceReviews] = useState<{
    id: string; user_id: string; storage_path: string; duration_seconds: number;
    voice_mode: string; has_spoiler: boolean; created_at: string;
    user_name?: string; user_avatar?: string | null;
    reactions: { clap: number; laugh: number; replay: number };
  }[]>([])

  // State: Cast fan
  const [fanIds, setFanIds] = useState<Set<number>>(new Set())

  // State: TV seasons/episodes
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null)
  const [seasonEpisodes, setSeasonEpisodes] = useState<Record<number, Episode[]>>({})
  const [episodeWatches, setEpisodeWatches] = useState<Set<string>>(new Set())
  const [loadingSeason, setLoadingSeason] = useState<number | null>(null)

  // State: Providers
  const [providers, setProviders] = useState<WatchProviders | null>(null)

  // State: Match score
  const [matchScore, setMatchScore] = useState<number | null>(null)
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null)

  // State: Share card
  const [shareCardType, setShareCardType] = useState<'mark' | 'clip' | null>(null)

  // State: UI
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)
  const [editProposal, setEditProposal] = useState<{ fieldName: string; fieldLabel: string; currentValue: string } | null>(null)
  const [showAllCast, setShowAllCast] = useState(false)
  const [showAllCrew, setShowAllCrew] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // ユーザー登録作品（負のID）はローカルDBから取得
      if (workId < 0) {
        const res = await fetch(`/api/tmdb?action=detail&id=${workId}&type=${workType}&lang=${tmdbLang}`)
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const row = await res.json()
        // DB行をTMDB風のオブジェクトに変換
        const asDetail: TMDBDetail = {
          id: row.id,
          title: row.title || '',
          name: row.title || '',
          original_title: row.original_title || '',
          original_name: row.original_title || '',
          overview: row.overview || '',
          poster_path: row.poster_path || null,
          backdrop_path: row.backdrop_path || null,
          release_date: row.release_date || '',
          first_air_date: row.release_date || '',
          runtime: row.runtime || null,
          vote_average: row.vote_average || 0,
          vote_count: row.vote_count || 0,
          genres: row.genres || [],
          production_countries: row.production_countries || [],
          credits: row.credits || { cast: [], crew: [] },
          similar: { results: [] },
          recommendations: { results: [] },
          videos: { results: [] },
          seasons: [],
          tagline: '',
          status: row.status || '',
          production_companies: [],
          number_of_seasons: row.number_of_seasons || 0,
          number_of_episodes: row.number_of_episodes || 0,
          data_source: row.data_source || 'user',
        }
        setDetail(asDetail)
        setProviders(null)
        return
      }

      const res = await fetch(`/api/tmdb?action=detail&id=${workId}&type=${workType}&lang=${tmdbLang}`)
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
        id: data.id,
        tmdb_id: data.id,
        title,
        original_title: data.original_title || data.original_name || title,
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path,
        release_date: releaseDate,
        genres: data.genres,
        vote_average: data.vote_average,
        overview: data.overview,
        media_type: workType,
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
      .maybeSingle()

    if (wl) {
      setWatchEntry(wl)
      setCurrentStatus(wl.status as WatchStatus)
      setScore(wl.score || 0)
      setWatchedDate(wl.watched_at || '')
      setWatchedDateMode(wl.watched_at_approx as 'old' | 'recent' | 'exact' | '' || (wl.watched_at ? 'exact' : ''))
      setWatchMethod(WATCH_METHODS_REVERSE[wl.watch_method] || wl.watch_method || '')
      setStreamingPlatform(wl.streaming_platform || '')
      setClipMemo(wl.memo || '')
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
      setReviewSpoiler(rv.has_spoiler || false)
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

    // Episode watches (TV) — join through episodes table
    if (workType === 'tv') {
      const { data: episodes } = await supabase
        .from('episodes')
        .select('id, season_number, episode_number')
        .eq('movie_id', workId)

      if (episodes && episodes.length > 0) {
        const episodeIds = episodes.map((e: { id: string }) => e.id)
        const { data: ew } = await supabase
          .from('episode_watches')
          .select('episode_id')
          .eq('user_id', userId)
          .in('episode_id', episodeIds)

        if (ew) {
          const watchedEpIds = new Set(ew.map((e: { episode_id: string }) => e.episode_id))
          const keys = episodes
            .filter((e: { id: string }) => watchedEpIds.has(e.id))
            .map((e: { season_number: number; episode_number: number }) => `s${e.season_number}e${e.episode_number}`)
          setEpisodeWatches(new Set(keys))
        }
      }
    }
  }, [userId, workId, workType])

  const fetchReviews = useCallback(async () => {
    let query = supabase
      .from('reviews')
      .select('*, users(name, avatar_url)')
      .eq('movie_id', workId)
      .neq('user_id', userId)
      .eq('is_draft', false)

    if (blockedUserIds.size > 0) {
      query = query.not('user_id', 'in', `(${[...blockedUserIds].join(',')})`)
    }

    const { data } = await query

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

    const enriched: ReviewWithUser[] = data.map((r: ReviewEntry & { users: { name: string; avatar_url: string | null } | null }) => ({
      ...r,
      likes_count: likesMap[r.id] || 0,
      liked_by_me: myLikes.has(r.id),
    }))

    setReviews(enriched)
  }, [workId, userId, blockedUserIds])

  const fetchVoiceReviews = useCallback(async () => {
    if (!VOICE_REVIEW_ENABLED) { setVoiceReviews([]); return }
    const { data: vrs } = await supabase
      .from('voice_reviews')
      .select('id, user_id, storage_path, duration_seconds, voice_mode, has_spoiler, created_at')
      .eq('movie_id', workId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!vrs || vrs.length === 0) { setVoiceReviews([]); return }

    // Get user info
    const userIds = [...new Set(vrs.map((v: { user_id: string }) => v.user_id))]
    const { data: users } = await supabase.from('users').select('id, name, avatar_url').in('id', userIds)
    const userMap = new Map((users || []).map((u: { id: string; name: string; avatar_url: string | null }) => [u.id, u]))

    // Get reactions
    const vrIds = vrs.map((v: { id: string }) => v.id)
    const { data: rxns } = await supabase.from('voice_reactions').select('voice_review_id, sound_type').in('voice_review_id', vrIds)
    const rxnMap: Record<string, { clap: number; laugh: number; replay: number }> = {}
    for (const r of rxns || []) {
      if (!rxnMap[r.voice_review_id]) rxnMap[r.voice_review_id] = { clap: 0, laugh: 0, replay: 0 }
      const key = r.sound_type as 'clap' | 'laugh' | 'replay'
      rxnMap[r.voice_review_id][key]++
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    setVoiceReviews(vrs.map((v: { id: string; user_id: string; storage_path: string; duration_seconds: number; voice_mode: string; has_spoiler: boolean; created_at: string }) => {
      const u = userMap.get(v.user_id)
      return {
        ...v,
        user_name: u?.name || '匿名ユーザー',
        user_avatar: u?.avatar_url,
        reactions: rxnMap[v.id] || { clap: 0, laugh: 0, replay: 0 },
        audioUrl: `${supabaseUrl}/storage/v1/object/public/voice-reviews/${v.storage_path}`,
      }
    }))
  }, [workId])

  const fetchClipMemos = useCallback(async () => {
    const { data } = await supabase
      .from('watchlists')
      .select('id, user_id, memo, score, users(name, avatar_url)')
      .eq('movie_id', workId)
      .eq('status', 'want_to_watch')
      .neq('user_id', userId)
    if (data) {
      setClipMemos((data as unknown as ClipMemoEntry[]).filter(d => (d.memo && d.memo.trim()) || (d.score && d.score > 0)))
    }
  }, [workId, userId])

  useEffect(() => {
    fetchDetail()
    fetchUserData()
    fetchReviews()
    fetchVoiceReviews()
    fetchClipMemos()
    scrollRef.current?.scrollTo(0, 0)
  }, [fetchDetail, fetchUserData, fetchReviews, fetchVoiceReviews, fetchClipMemos])

  // Build taste profile once per mount
  useEffect(() => {
    buildTasteProfile(userId).then(setTasteProfile)
  }, [userId])

  // Fetch blocked users to filter from reviews
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId)
      if (cancelled) return
      const ids = new Set<string>((data || []).map((r: { blocked_id: string }) => r.blocked_id))
      setBlockedUserIds(ids)
    })()
    return () => { cancelled = true }
  }, [userId])

  const handleBlockUser = useCallback(async (targetUserId: string) => {
    if (!confirm('このユーザーをブロックします。\nブロックすると、相手のレビューやリストが表示されなくなります。')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast('ログインが必要です'); return }
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ blockedId: targetUserId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'ブロックに失敗しました')
        return
      }
      setBlockedUserIds(prev => new Set(prev).add(targetUserId))
      setReviews(prev => prev.filter(r => r.user_id !== targetUserId))
      showToast('ブロックしました')
    } catch {
      showToast('ブロックに失敗しました')
    }
  }, [])

  // Calculate match score when detail and profile are ready
  useEffect(() => {
    if (!tasteProfile || !detail) return
    const score = calculateMatchScore(tasteProfile, {
      genres: detail.genres,
      credits: detail.credits,
    })
    setMatchScore(score)
  }, [tasteProfile, detail])

  // ── Watchlist Actions ────────────────────────────────────────────────────

  const handleStatusChange = async (status: WatchStatus) => {
    if (!status) return
    setSavingWatchlist(true)
    try {
      if (watchEntry) {
        const updateData: Record<string, unknown> = { status }
        if (score > 0) updateData.score = score
        const { error: updateErr } = await supabase
          .from('watchlists')
          .update(updateData)
          .eq('id', watchEntry.id)
        if (updateErr) throw new Error(updateErr.message)
        setWatchEntry({ ...watchEntry, status })
      } else {
        const insertData: Record<string, unknown> = {
          user_id: userId, movie_id: workId, status,
        }
        if (score > 0) insertData.score = score
        const { data, error: insertErr } = await supabase
          .from('watchlists')
          .insert(insertData)
          .select('*')
          .single()
        if (insertErr) throw new Error(insertErr.message)
        if (data) setWatchEntry(data as unknown as WatchlistEntry)
      }
      setCurrentStatus(status)

      if (status === 'watched') {
        await addPoints(userId, POINT_CONFIG.WATCH_COMPLETE, '鑑賞完了')
        showToast('✓ Watched に追加しました！ +' + POINT_CONFIG.WATCH_COMPLETE + 'pt')
      } else if (status === 'want_to_watch') {
        showToast('📌 Watchlist に追加しました')
      } else if (status === 'watching') {
        showToast('📺 Watching に設定しました')
      }
    } catch {
      showToast('エラーが発生しました')
    } finally {
      setSavingWatchlist(false)
    }
  }

  const handleScoreChange = async (newScore: number) => {
    setScore(newScore)
    if (watchEntry && newScore > 0) {
      const { error } = await supabase
        .from('watchlists')
        .update({ score: newScore })
        .eq('id', watchEntry.id)
      if (error) console.error('Score update failed:', error)
    }
  }

  const handleSaveWatchDetails = async () => {
    if (!watchEntry) {
      showToast('先にWatchedまたはWatchlistボタンを押してください')
      return
    }
    setSavingWatchlist(true)
    try {
      const updateData: Record<string, unknown> = {}
      if (currentStatus === 'watched' || currentStatus === 'watching') {
        if (watchedDateMode === 'exact' && watchedDate) updateData.watched_at = watchedDate
        if (watchedDateMode && watchedDateMode !== 'exact') updateData.watched_at_approx = watchedDateMode
        if (watchedDateMode === 'exact') updateData.watched_at_approx = 'exact'
        if (watchMethod) updateData.watch_method = WATCH_METHODS_MAP[watchMethod] || watchMethod
        if (watchMethod === '配信' && streamingPlatform) updateData.streaming_platform = streamingPlatform
        if (score > 0) updateData.score = score
      }
      if (currentStatus === 'want_to_watch') {
        if (clipMemo) updateData.memo = clipMemo
        if (score > 0) updateData.score = score
      }
      if (Object.keys(updateData).length === 0) {
        showToast('変更がありません')
        setSavingWatchlist(false)
        return
      }
      const { error: updateErr } = await supabase
        .from('watchlists')
        .update(updateData)
        .eq('id', watchEntry.id)
      if (updateErr) throw new Error(updateErr.message)
      setWatchEntry({ ...watchEntry, ...updateData } as typeof watchEntry)
      showToast('保存しました')
      if (currentStatus === 'want_to_watch' && (clipMemo.trim() || score > 0)) {
        setShareCardType('clip')
      }
    } catch (e) {
      console.error('Save watch details failed:', e)
      showToast('保存に失敗しました')
    } finally {
      setSavingWatchlist(false)
    }
  }

  // ── Review Actions ───────────────────────────────────────────────────────

  const handleSaveReview = async (isDraft: boolean) => {
    if (savingReview) return
    if (!reviewBody.trim()) {
      showToast('レビュー本文を入力してください')
      return
    }
    setSavingReview(true)
    try {
      // movies テーブルに作品が無いと FK 違反で reviews.insert が落ちる。
      // fetchDetail で upsert してるはずだが、レアケース (ネットワーク失敗等) に備えて
      // 必須最小フィールドで upsert する。
      if (detail) {
        await supabase.from('movies').upsert({
          id: workId,
          tmdb_id: workId,
          title: detail.title || detail.name || '',
          poster_path: detail.poster_path,
          media_type: workType,
        }, { onConflict: 'tmdb_id' })
      }

      const reviewData: Record<string, unknown> = {
        user_id: userId, movie_id: workId, body: reviewBody,
        has_spoiler: reviewSpoiler,
        is_draft: isDraft,
      }
      if (score > 0) reviewData.score = score

      if (myReview) {
        const { error: revErr } = await supabase
          .from('reviews')
          .update({ ...reviewData, updated_at: new Date().toISOString() })
          .eq('id', myReview.id)
        if (revErr) throw new Error(revErr.message)
        setMyReview({ ...myReview, ...reviewData } as typeof myReview)
      } else {
        const { data, error: revErr } = await supabase
          .from('reviews')
          .insert(reviewData)
          .select('*')
          .single()
        if (revErr) throw new Error(revErr.message)
        if (data) setMyReview(data as unknown as ReviewEntry)
      }

      setReviewDraft(isDraft)

      if (!isDraft) {
        const pts = (reviewBody.length >= 100)
          ? POINT_CONFIG.REVIEW_LONG
          : POINT_CONFIG.REVIEW_SHORT
        await addPoints(userId, pts, 'レビュー投稿')
        // GA4: レビュー投稿 (key event 候補)
        trackReviewPosted(workId, score || 0, false)
        showToast(`✍️ レビューを投稿しました！ +${pts}pt`)
        setReviewJustSaved('posted')
        setShareCardType('mark')
      } else {
        trackReviewPosted(workId, score || 0, true)
        showToast('下書きを保存しました')
        setReviewJustSaved('draft')
      }
      setTimeout(() => setReviewJustSaved(null), 5000)
    } catch (err) {
      // エラー詳細を console + toast (ユーザーにも具体的に見せる)
      console.error('Review save failed:', err)
      const msg = err instanceof Error ? err.message : 'レビューの保存に失敗しました'
      showToast(`保存失敗: ${msg.length > 60 ? msg.slice(0, 60) + '…' : msg}`)
      setReviewJustSaved('failed')
      setTimeout(() => setReviewJustSaved(null), 8000)
    } finally {
      setSavingReview(false)
    }
  }

  const handleDeleteReview = async () => {
    if (!myReview) return
    if (!confirm('このレビューを削除しますか?\n削除すると元に戻せません。')) return
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', myReview.id)
    if (error) {
      console.error('Review delete failed:', error)
      showToast('削除に失敗しました')
      return
    }
    setMyReview(null)
    setReviewBody('')
    setReviewSpoiler(false)
    setReviewDraft(false)
    showToast('レビューを削除しました')
  }

  // ── Like Action ──────────────────────────────────────────────────────────

  const handleLike = async (review: ReviewWithUser) => {
    if (review.liked_by_me) {
      // Unlike
      const { error: delErr } = await supabase
        .from('likes')
        .delete()
        .eq('review_id', review.id)
        .eq('user_id', userId)
      if (delErr) { console.error('Unlike failed:', delErr); return }
      setReviews(prev =>
        prev.map(r => r.id === review.id
          ? { ...r, liked_by_me: false, likes_count: r.likes_count - 1 }
          : r)
      )
    } else {
      // Like
      const { error: likeErr } = await supabase
        .from('likes')
        .insert({ review_id: review.id, user_id: userId })
      if (likeErr) { console.error('Like failed:', likeErr); return }
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
      const { error: delErr } = await supabase
        .from('fans')
        .delete()
        .eq('user_id', userId)
        .eq('person_id', personId)
      if (delErr) { console.error('Fan delete failed:', delErr); return }
      setFanIds(prev => { const n = new Set(prev); n.delete(personId); return n })
      showToast(`${personName} のファンを解除しました`)
    } else {
      const { error: fanErr } = await supabase
        .from('fans')
        .insert({ user_id: userId, person_id: personId, person_name: personName })
      if (fanErr) { console.error('Fan insert failed:', fanErr); return }
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

    // Find episode metadata from TMDB data already loaded
    const tmdbEp = seasonEpisodes[seasonNumber]?.find(e => e.episode_number === episodeNumber)

    // Upsert episode into DB (ensures it exists before tracking watches)
    const { data: ep } = await supabase
      .from('episodes')
      .upsert({
        movie_id: workId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        title: tmdbEp?.name || null,
        overview: tmdbEp?.overview || null,
        air_date: tmdbEp?.air_date || null,
        runtime: tmdbEp?.runtime || null,
        still_path: tmdbEp?.still_path || null,
      }, { onConflict: 'movie_id,season_number,episode_number' })
      .select('id')
      .single()

    if (!ep) return

    if (episodeWatches.has(key)) {
      await supabase
        .from('episode_watches')
        .delete()
        .eq('user_id', userId)
        .eq('episode_id', ep.id)
      setEpisodeWatches(prev => { const n = new Set(prev); n.delete(key); return n })
    } else {
      await supabase
        .from('episode_watches')
        .insert({ user_id: userId, episode_id: ep.id })
      setEpisodeWatches(prev => new Set(prev).add(key))
    }
  }

  const handleToggleAllEpisodes = async (seasonNumber: number) => {
    const episodes = seasonEpisodes[seasonNumber] || []
    if (episodes.length === 0) return

    const allWatched = episodes.every(
      ep => episodeWatches.has(`s${seasonNumber}e${ep.episode_number}`)
    )

    // Upsert all episodes into DB first
    const rows = episodes.map(ep => ({
      movie_id: workId,
      season_number: seasonNumber,
      episode_number: ep.episode_number,
      title: ep.name || null,
      overview: ep.overview || null,
      air_date: ep.air_date || null,
      runtime: ep.runtime || null,
      still_path: ep.still_path || null,
    }))
    const { data: dbEps } = await supabase
      .from('episodes')
      .upsert(rows, { onConflict: 'movie_id,season_number,episode_number' })
      .select('id, episode_number')

    if (!dbEps || dbEps.length === 0) return

    if (allWatched) {
      // Remove all watches for this season
      const epIds = dbEps.map((e: { id: string }) => e.id)
      await supabase
        .from('episode_watches')
        .delete()
        .eq('user_id', userId)
        .in('episode_id', epIds)
      setEpisodeWatches(prev => {
        const n = new Set(prev)
        episodes.forEach(ep => n.delete(`s${seasonNumber}e${ep.episode_number}`))
        return n
      })
    } else {
      // Mark all as watched
      const watchRows = dbEps.map((e: { id: string }) => ({
        user_id: userId,
        episode_id: e.id,
      }))
      await supabase
        .from('episode_watches')
        .upsert(watchRows, { onConflict: 'user_id,episode_id' })
      setEpisodeWatches(prev => {
        const n = new Set(prev)
        episodes.forEach(ep => n.add(`s${seasonNumber}e${ep.episode_number}`))
        return n
      })
    }
  }

  // ── Sorted/Filtered Reviews ──────────────────────────────────────────────

  const sortedReviews = [...reviews]
    .filter(r => spoilerFilter === 'all' || !r.has_spoiler)
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
    pencilBtn: {
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: 14, padding: 4, opacity: 0.5, flexShrink: 0,
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
      {/* ユーザー登録作品バナー */}
      {detail.data_source === 'user' && (
        <div style={{ margin: '0 16px 8px', padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(162,155,254,0.08))', border: '1px solid var(--fm-accent)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span>📝</span>
          <span style={{ color: 'var(--fm-text-sub)' }}>この作品はユーザーが登録しました（TMDB未登録）</span>
        </div>
      )}

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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <h1 style={{ ...s.title, flex: 1 }}>{title}</h1>
            <button
              onClick={() => setEditProposal({ fieldName: 'title', fieldLabel: 'タイトル', currentValue: title })}
              style={s.pencilBtn}
              title="タイトルの修正を提案"
            >✏️</button>
          </div>
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

      {/* ── Match Score ── */}
      {matchScore !== null && (
        <div style={{
          margin: '12px 16px 0',
          padding: '14px 16px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(162,155,254,0.08))',
          border: '1px solid rgba(108,92,231,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            position: 'relative',
            width: 56, height: 56, flexShrink: 0,
          }}>
            <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="28" cy="28" r="24" fill="none"
                stroke="rgba(108,92,231,0.2)" strokeWidth="4" />
              <circle cx="28" cy="28" r="24" fill="none"
                stroke={matchScore >= 80 ? '#2ecc8a' : matchScore >= 60 ? '#6c5ce7' : '#e67e22'}
                strokeWidth="4"
                strokeDasharray={`${(matchScore / 100) * 150.8} 150.8`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800,
              color: matchScore >= 80 ? '#2ecc8a' : matchScore >= 60 ? '#a29bfe' : '#e67e22',
            }}>
              {matchScore}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 2 }}>
              あなたへのマッチ度
            </div>
            <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', lineHeight: 1.5 }}>
              {matchScore >= 80
                ? 'あなたの好みにとても合いそうです!'
                : matchScore >= 65
                  ? 'あなたの好みに合う可能性があります'
                  : 'あなたの好みとはやや異なるかも'
              }
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Action Buttons ── */}
      <div style={s.actionRow}>
        <button
          style={s.actionBtn(currentStatus === 'watched', 'var(--fm-success)')}
          onClick={() => handleStatusChange('watched')}
          disabled={savingWatchlist}
        >
          ✓ Watched
        </button>
        <button
          style={s.actionBtn(currentStatus === 'want_to_watch')}
          onClick={() => handleStatusChange('want_to_watch')}
          disabled={savingWatchlist}
        >
          📌 Watchlist
        </button>
        {workType === 'tv' && (
          <button
            style={s.actionBtn(currentStatus === 'watching', 'var(--fm-warning)')}
            onClick={() => handleStatusChange('watching')}
            disabled={savingWatchlist}
          >
            📺 Watching
          </button>
        )}
      </div>

      {/* ── 4a. Mark Panel: Voice Review + Star + Review + Watch Details ──
        Watched/Watching を選んでなくても表示する (Letterboxd方式)。
        「★とレビューだけ書く」ユースケースもあるため、未選択でも入力可能。
        実保存時に handleSaveReview 内で必要なら status を自動で 'watched' に上げる。 */}
      {(currentStatus === 'watched' || currentStatus === 'watching' || currentStatus === null) && (
        <div style={{ ...s.section }}>
          {currentStatus === null && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 12,
              background: 'rgba(108,92,231,0.10)', border: '1px solid rgba(108,92,231,0.3)',
              fontSize: 13, color: 'var(--fm-accent)',
            }}>
              💡 上の「✓ Watched」を押してから書くと正確な記録になります(レビューだけでも投稿可)
            </div>
          )}
          {/* Voice Review Recorder */}
          {VOICE_REVIEW_ENABLED && detail && (
            <div style={{ marginBottom: 12 }}>
              <VoiceReviewRecorder
                movieId={workId}
                movieTitle={detail.title || detail.name || ''}
                userId={userId}
                onComplete={fetchVoiceReviews}
                onTranscript={text => { if (!reviewBody.trim()) setReviewBody(text) }}
              />
            </div>
          )}

          {/* Voice Review List */}
          {VOICE_REVIEW_ENABLED && voiceReviews.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', margin: '0 0 10px' }}>
                🎙️ ボイスレビュー ({voiceReviews.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {voiceReviews.map(vr => (
                  <VoiceReviewPlayer
                    key={vr.id}
                    audioUrl={(vr as unknown as { audioUrl: string }).audioUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/voice-reviews/${vr.storage_path}`}
                    voiceReviewId={vr.id}
                    userName={vr.user_name || '匿名'}
                    userAvatar={vr.user_avatar}
                    voiceMode={vr.voice_mode}
                    durationSeconds={vr.duration_seconds}
                    hasSpoiler={vr.has_spoiler}
                    initialReactions={vr.reactions}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={s.card}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Star rating */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>評価:</span>
                <StarRating value={score} onChange={handleScoreChange} size={28} />
                {score > 0 && (
                  <span style={{ fontSize: 14, color: 'var(--fm-star)', fontWeight: 700 }}>
                    {score.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Review textarea */}
              <textarea
                style={s.textarea}
                value={reviewBody}
                onChange={e => setReviewBody(e.target.value)}
                placeholder="感想を書く..."
                maxLength={5000}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', flexWrap: 'wrap', gap: 8,
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
                    レビューを下書き
                  </button>
                  <button
                    style={{
                      ...s.primaryBtn, padding: '6px 14px', fontSize: 13,
                      opacity: (!reviewBody.trim() || savingReview) ? 0.5 : 1,
                    }}
                    onClick={() => handleSaveReview(false)}
                    disabled={savingReview || !reviewBody.trim()}
                  >
                    {savingReview ? '投稿中...' : myReview && !myReview.is_draft ? 'レビューを更新' : 'レビューを投稿'}
                  </button>
                </div>
              </div>
              {reviewDraft && myReview?.is_draft && (
                <div style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(240,192,64,0.1)', border: '1px solid var(--fm-warning)',
                  fontSize: 12, color: 'var(--fm-warning)',
                }}>
                  下書き保存中
                </div>
              )}
              {/* 保存直後インラインフィードバック (toast の保険) */}
              {reviewJustSaved === 'posted' && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(46,204,138,0.15)', border: '1px solid #2ecc8a',
                  fontSize: 13, fontWeight: 700, color: '#2ecc8a',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>✅</span><span>レビューを投稿しました</span>
                </div>
              )}
              {reviewJustSaved === 'draft' && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(240,192,64,0.15)', border: '1px solid var(--fm-warning)',
                  fontSize: 13, fontWeight: 600, color: 'var(--fm-warning)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>📝</span><span>下書きとして保存しました</span>
                </div>
              )}
              {reviewJustSaved === 'failed' && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444',
                  fontSize: 13, fontWeight: 700, color: '#ef4444',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>❌</span><span>保存に失敗しました。再度お試しください。</span>
                </div>
              )}

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--fm-border)', margin: '2px 0' }} />

              {/* Watch date: 昔 / 最近 / 日付入力 */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 6, display: 'block' }}>
                  鑑賞日
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: watchedDateMode === 'exact' ? 8 : 0 }}>
                  {([['old', '昔'], ['recent', '最近'], ['exact', '日付を入力']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      style={s.watchMethodBtn(watchedDateMode === val)}
                      onClick={() => setWatchedDateMode(watchedDateMode === val ? '' : val)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {watchedDateMode === 'exact' && (
                  <input
                    type="date"
                    value={watchedDate}
                    onChange={e => setWatchedDate(e.target.value)}
                    style={s.input}
                  />
                )}
              </div>

              {/* Watch method */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 6, display: 'block' }}>
                  視聴方法
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {WATCH_METHODS.map(method => (
                    <button
                      key={method}
                      style={s.watchMethodBtn(watchMethod === method)}
                      onClick={() => {
                        setWatchMethod(watchMethod === method ? '' : method)
                        if (method !== '配信') setStreamingPlatform('')
                      }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
                {/* Streaming platform picker */}
                {watchMethod === '配信' && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginBottom: 4, display: 'block' }}>
                      プラットフォーム
                    </label>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {STREAMING_PLATFORMS.map(p => (
                        <button
                          key={p}
                          style={{
                            ...s.watchMethodBtn(streamingPlatform === p),
                            fontSize: 11, padding: '4px 10px', minHeight: 28,
                          }}
                          onClick={() => setStreamingPlatform(streamingPlatform === p ? '' : p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                style={s.primaryBtn}
                onClick={handleSaveWatchDetails}
                disabled={savingWatchlist}
              >
                {savingWatchlist ? '保存中...' : '鑑賞情報を保存'}
              </button>
            </div>
          </div>

          {/* あなたのレビュー (投稿済み・公開状態) */}
          {myReview && !myReview.is_draft && myReview.body && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-accent)', margin: '0 0 8px' }}>
                ✍️ あなたのレビュー
              </h4>
              <div style={{
                ...s.reviewCard,
                borderLeft: '3px solid var(--fm-accent)',
                background: 'rgba(108,92,231,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    ...s.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: 'var(--fm-text-muted)',
                  }}>👤</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-accent)' }}>
                      あなた
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                      {new Date(myReview.created_at).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  {myReview.score && <StarRating value={myReview.score} size={16} readonly />}
                </div>
                <p style={{ fontSize: 14, color: 'var(--fm-text)', lineHeight: 1.7, margin: 0 }}>
                  {myReview.body}
                </p>
                {myReview.has_spoiler && (
                  <div style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(255,107,107,0.15)', color: 'var(--fm-danger)',
                    fontSize: 11, fontWeight: 600, marginTop: 8,
                  }}>⚠ ネタバレあり</div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => {
                      // 入力欄までスクロール
                      const ta = scrollRef.current?.querySelector('textarea')
                      if (ta) {
                        ta.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        ;(ta as HTMLTextAreaElement).focus()
                      }
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: '1px solid var(--fm-border)',
                      background: 'var(--fm-bg-card)', color: 'var(--fm-text)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >✏️ 編集</button>
                  <button
                    onClick={handleDeleteReview}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
                      background: 'transparent', color: 'var(--fm-danger)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >🗑️ 削除</button>
                </div>
              </div>
            </div>
          )}

          {/* みんなのレビュー inline */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8,
            }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', margin: 0 }}>
                💬 みんなのレビュー ({reviews.length})
              </h4>
              {reviews.length > 0 && (
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
              )}
            </div>
            {reviews.length > 0 && (
              <div style={s.tabRow}>
                {([
                  ['newest', '新着'],
                  ['likes', 'いいね数'],
                  ['score_high', 'スコア高い'],
                  ['score_low', 'スコア低い'],
                ] as [SortMode, string][]).map(([key, label]) => (
                  <button key={key} style={s.tab(reviewSort === key)} onClick={() => setReviewSort(key)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {sortedReviews.length === 0 ? (
              <p style={{ color: 'var(--fm-text-muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>
                まだレビューはありません
              </p>
            ) : sortedReviews.map(review => (
                <div key={review.id} style={s.reviewCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Link href={`/u/${review.user_id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'contents' }}>
                      {review.users?.avatar_url ? (
                        <img src={review.users.avatar_url} alt="" style={{ ...s.avatar, cursor: 'pointer' }} />
                      ) : (
                        <div style={{
                          ...s.avatar, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)',
                          cursor: 'pointer',
                        }}>👤</div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', cursor: 'pointer' }}>
                          {review.users?.name || '匿名ユーザー'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                          {new Date(review.created_at).toLocaleDateString('ja-JP')}
                        </div>
                      </div>
                    </Link>
                    {review.score && <StarRating value={review.score} size={16} readonly />}
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setOpenMenuReviewId(openMenuReviewId === review.id ? null : review.id)}
                        aria-label="メニュー"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--fm-text-muted)', fontSize: 18, padding: '4px 8px',
                          borderRadius: 6, lineHeight: 1,
                        }}
                      >⋯</button>
                      {openMenuReviewId === review.id && (
                        <>
                          <div
                            onClick={() => setOpenMenuReviewId(null)}
                            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                          />
                          <div style={{
                            position: 'absolute', top: '100%', right: 0, zIndex: 51,
                            background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
                            borderRadius: 10, minWidth: 160, padding: 4,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          }}>
                            <button
                              onClick={() => {
                                setReportTarget({
                                  type: 'review',
                                  id: review.id,
                                  label: `${review.users?.name || '匿名ユーザー'} さんのレビュー`,
                                })
                                setOpenMenuReviewId(null)
                              }}
                              style={{
                                width: '100%', textAlign: 'left', padding: '10px 12px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--fm-text)', fontSize: 13, borderRadius: 6,
                              }}
                            >🚩 通報する</button>
                            <button
                              onClick={() => {
                                setOpenMenuReviewId(null)
                                handleBlockUser(review.user_id)
                              }}
                              style={{
                                width: '100%', textAlign: 'left', padding: '10px 12px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--fm-danger)', fontSize: 13, borderRadius: 6,
                              }}
                            >🚫 ユーザーをブロック</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {review.has_spoiler && !revealedSpoilers.has(review.id) ? (
                    <div className="spoiler-text"
                      onClick={() => setRevealedSpoilers(prev => new Set(prev).add(review.id))}
                      style={{ padding: '8px 12px', fontSize: 14, lineHeight: 1.7 }}>
                      {review.body}
                    </div>
                  ) : review.has_spoiler ? (
                    <>
                      <div style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        background: 'rgba(255,107,107,0.15)', color: 'var(--fm-danger)',
                        fontSize: 11, fontWeight: 600, marginBottom: 6,
                      }}>⚠ {t('review.spoiler')}</div>
                      <div className="spoiler-text revealed"
                        style={{ padding: '4px 0', fontSize: 14, lineHeight: 1.7 }}>
                        {review.body}
                      </div>
                      {review.body && <TranslateButton reviewId={review.id} text={review.body} />}
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, color: 'var(--fm-text)', lineHeight: 1.7, margin: 0 }}>
                        {review.body}
                      </p>
                      {review.body && <TranslateButton reviewId={review.id} text={review.body} />}
                    </>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                    <button style={s.likeBtn(review.liked_by_me)} onClick={() => handleLike(review)}>
                      {review.liked_by_me ? '❤️' : '🤍'} {review.likes_count}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}


      {/* ── 4b. Clip Panel: Voice + Star + Memo + Match Score ── */}
      {currentStatus === 'want_to_watch' && (
        <div style={{ ...s.section }}>
          {/* 期待の声 Recorder */}
          {VOICE_REVIEW_ENABLED && detail && (
            <div style={{ marginBottom: 12 }}>
              <VoiceReviewRecorder
                movieId={workId}
                movieTitle={detail.title || detail.name || ''}
                userId={userId}
                onComplete={fetchVoiceReviews}
                onTranscript={text => { if (!clipMemo.trim()) setClipMemo(text) }}
                label="期待の声"
                promptText={`「${detail.title || detail.name || ''}」への期待を声で伝えよう`}
              />
            </div>
          )}

          <div style={s.card}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Expectation star rating */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>期待度:</span>
                <StarRating value={score} onChange={handleScoreChange} size={28} />
                {score > 0 && (
                  <span style={{ fontSize: 14, color: 'var(--fm-star)', fontWeight: 700 }}>
                    {score.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Why do you want to watch? */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 6, display: 'block' }}>
                  なぜ観たい？ / 何が楽しみ？
                </label>
                <textarea
                  style={{ ...s.textarea, minHeight: 60 }}
                  value={clipMemo}
                  onChange={e => setClipMemo(e.target.value)}
                  placeholder="気になった理由、期待していることなど..."
                  maxLength={500}
                />
                <div style={{ fontSize: 12, color: 'var(--fm-text-muted)', textAlign: 'right', marginTop: 4 }}>
                  {clipMemo.length} / 500
                </div>
              </div>

              <button
                style={s.primaryBtn}
                onClick={handleSaveWatchDetails}
                disabled={savingWatchlist}
              >
                {savingWatchlist ? '保存中...' : '鑑賞情報を保存'}
              </button>
            </div>
          </div>

          {/* みんなの「なぜ観たい」 inline */}
          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', margin: '0 0 10px' }}>
              📌 みんなのWatchlist理由 ({clipMemos.length})
            </h4>
            {clipMemos.length === 0 ? (
              <p style={{ color: 'var(--fm-text-muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>
                まだ投稿はありません
              </p>
            ) : clipMemos.map(cm => (
              <div key={cm.id} style={{
                ...s.card, marginBottom: 8, padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Link href={`/u/${cm.user_id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'contents' }}>
                    {cm.users?.avatar_url ? (
                      <img src={cm.users.avatar_url} alt="" style={{ ...s.avatar, width: 24, height: 24, cursor: 'pointer' }} />
                    ) : (
                      <div style={{
                        ...s.avatar, width: 24, height: 24,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: 'var(--fm-text-muted)', cursor: 'pointer',
                      }}>👤</div>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text)', flex: 1, cursor: 'pointer' }}>
                      {cm.users?.name || '匿名ユーザー'}
                    </span>
                  </Link>
                  {cm.score && cm.score > 0 && <StarRating value={cm.score} size={14} readonly />}
                </div>
                {cm.memo && (
                  <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', lineHeight: 1.6, margin: 0 }}>
                    {cm.memo}
                  </p>
                )}
              </div>
            ))}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={s.sectionTitle}>あらすじ</h3>
            <button
              onClick={() => setEditProposal({ fieldName: 'overview', fieldLabel: 'あらすじ', currentValue: detail.overview })}
              style={s.pencilBtn}
              title="あらすじの修正を提案"
            >✏️</button>
          </div>
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

      {/* ── 9. Cast & Crew (Enhanced) ── */}
      {(cast.length > 0 || director) && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>👥 キャスト</h3>

          {/* Cast scroll */}
          <div style={s.hScroll}>
            {(showAllCast ? cast : cast.slice(0, 10)).map(person => (
              <div key={person.id} style={s.personCard} onClick={() => onOpenPerson?.(person.id)}>
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
                <button style={s.fanBtn(fanIds.has(person.id))} onClick={(e) => { e.stopPropagation(); handleToggleFan(person.id, person.name) }}>
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
                  <div key={`dir-${d.id}`} style={{ ...s.crewRow, cursor: 'pointer' }} onClick={() => onOpenPerson?.(d.id)}>
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
                    <button style={s.fanBtn(fanIds.has(d.id))} onClick={(e) => { e.stopPropagation(); handleToggleFan(d.id, d.name) }}>
                      {fanIds.has(d.id) ? 'Fan! ✓' : 'Fan!'}
                    </button>
                  </div>
                ))}
                {/* Writers */}
                {writers.map(w => (
                  <div key={`wr-${w.id}`} style={{ ...s.crewRow, cursor: 'pointer' }} onClick={() => onOpenPerson?.(w.id)}>
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
                    <button style={s.fanBtn(fanIds.has(w.id))} onClick={(e) => { e.stopPropagation(); handleToggleFan(w.id, w.name) }}>
                      {fanIds.has(w.id) ? 'Fan! ✓' : 'Fan!'}
                    </button>
                  </div>
                ))}
                {/* Show more crew (composers, cinematographers, editors) */}
                {showAllCrew && (
                  <>
                    {composers.map(c => (
                      <div key={`comp-${c.id}`} style={{ ...s.crewRow, cursor: 'pointer' }} onClick={() => onOpenPerson?.(c.id)}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fm-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)' }}>🎵</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>音楽</div>
                        </div>
                      </div>
                    ))}
                    {cinematographers.map(c => (
                      <div key={`cin-${c.id}`} style={{ ...s.crewRow, cursor: 'pointer' }} onClick={() => onOpenPerson?.(c.id)}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fm-bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)' }}>📷</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>撮影</div>
                        </div>
                      </div>
                    ))}
                    {editors.map(e => (
                      <div key={`ed-${e.id}`} style={{ ...s.crewRow, cursor: 'pointer' }} onClick={() => onOpenPerson?.(e.id)}>
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
                      ) : (<>
                        <button
                          onClick={() => handleToggleAllEpisodes(season.season_number)}
                          style={{
                            width: '100%', padding: '8px 0', marginBottom: 8,
                            border: '1px solid var(--fm-border)', borderRadius: 6,
                            background: watchedCount === totalEps ? 'var(--fm-bg-hover)' : 'var(--fm-accent)',
                            color: watchedCount === totalEps ? 'var(--fm-text-sub)' : '#fff',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          {watchedCount === totalEps ? '全話チェック解除' : `全${totalEps}話を視聴済みにする`}
                        </button>
                        {episodes.map(ep => {
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
                        })}
                      </>)}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {/* Bottom spacing */}
      <div style={{ height: 60 }} />

      {/* Share Card Modal */}
      {shareCardType === 'mark' && detail && (
        <ShareCard
          type="mark"
          data={{
            title: detail.title || detail.name || '',
            posterPath: detail.poster_path,
            score,
            reviewBody,
          }}
          userId={userId}
          onClose={() => setShareCardType(null)}
        />
      )}
      {shareCardType === 'clip' && detail && (
        <ShareCard
          type="clip"
          data={{
            title: detail.title || detail.name || '',
            posterPath: detail.poster_path,
            score,
            memo: clipMemo,
          }}
          userId={userId}
          onClose={() => setShareCardType(null)}
        />
      )}

      {/* 修正提案モーダル */}
      {editProposal && detail && (
        <EditProposalModal
          userId={userId}
          movieId={detail.id}
          fieldName={editProposal.fieldName}
          fieldLabel={editProposal.fieldLabel}
          currentValue={editProposal.currentValue}
          onClose={() => setEditProposal(null)}
          onSubmitted={() => {
            showToast('提案が送信されました')
          }}
        />
      )}

      {/* 通報モーダル */}
      {reportTarget && (
        <ReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetLabel={reportTarget.label}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  )
}
