'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

interface DashboardProps {
  userId: string
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}

interface MediaItem {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  media_type?: string
  vote_average?: number
  release_date?: string
  first_air_date?: string
}

interface WatchlistEntry {
  tmdb_id: number
  media_type: string
  score: number | null
  watched_at: string | null
  movies: {
    title: string
    poster_path: string | null
    tmdb_id: number
    media_type: string
    vote_average: number | null
  }
}

export default function Dashboard({ userId, onOpenWork }: DashboardProps) {
  const [trending, setTrending] = useState<MediaItem[]>([])
  const [nowPlaying, setNowPlaying] = useState<MediaItem[]>([])
  const [recent, setRecent] = useState<WatchlistEntry[]>([])
  const [recommended, setRecommended] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sectionLoading, setSectionLoading] = useState({
    trending: true,
    nowPlaying: true,
    recent: true,
    recommended: true,
  })

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch('/api/tmdb?action=trending')
      if (!res.ok) throw new Error('Failed to fetch trending')
      const data = await res.json()
      setTrending(data.results || [])
    } catch (err) {
      console.error('Trending fetch error:', err)
    } finally {
      setSectionLoading(prev => ({ ...prev, trending: false }))
    }
  }, [])

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch('/api/tmdb?action=now_playing')
      if (!res.ok) throw new Error('Failed to fetch now playing')
      const data = await res.json()
      setNowPlaying(data.results || [])
    } catch (err) {
      console.error('Now playing fetch error:', err)
    } finally {
      setSectionLoading(prev => ({ ...prev, nowPlaying: false }))
    }
  }, [])

  const fetchRecent = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('watchlists')
        .select('tmdb_id, media_type, score, watched_at, movies(title, poster_path, tmdb_id, media_type, vote_average)')
        .eq('user_id', userId)
        .not('watched_at', 'is', null)
        .order('watched_at', { ascending: false })
        .limit(20)
      if (error) throw error
      setRecent((data || []) as unknown as WatchlistEntry[])
    } catch (err) {
      console.error('Recent fetch error:', err)
    } finally {
      setSectionLoading(prev => ({ ...prev, recent: false }))
    }
  }, [userId])

  const fetchRecommended = useCallback(async () => {
    try {
      const res = await fetch('/api/tmdb?action=trending&time_window=day')
      if (!res.ok) throw new Error('Failed to fetch recommended')
      const data = await res.json()
      setRecommended(data.results?.slice(0, 20) || [])
    } catch (err) {
      console.error('Recommended fetch error:', err)
    } finally {
      setSectionLoading(prev => ({ ...prev, recommended: false }))
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchTrending(), fetchNowPlaying(), fetchRecent(), fetchRecommended()])
      .finally(() => setLoading(false))
  }, [fetchTrending, fetchNowPlaying, fetchRecent, fetchRecommended])

  const getTitle = (item: MediaItem) => item.title || item.name || ''
  const getYear = (item: MediaItem) => {
    const d = item.release_date || item.first_air_date
    return d ? d.slice(0, 4) : ''
  }
  const getMediaType = (item: MediaItem): 'movie' | 'tv' => {
    if (item.media_type === 'tv') return 'tv'
    return 'movie'
  }

  const scoreColor = (score: number) => {
    if (score >= 7) return 'var(--fm-success)'
    if (score >= 5) return 'var(--fm-warning)'
    return 'var(--fm-danger)'
  }

  const mediaTypeLabel = (type: string) => {
    if (type === 'tv') return 'TV'
    if (type === 'movie') return '映画'
    return type
  }

  return (
    <div className="animate-fade-in" style={{ padding: '16px 0' }}>
      {/* Trending Section */}
      <Section
        title="トレンド"
        emoji="🔥"
        loading={sectionLoading.trending}
      >
        <ScrollRow>
          {trending.map(item => (
            <PosterCard
              key={`trending-${item.id}`}
              posterPath={item.poster_path}
              title={getTitle(item)}
              year={getYear(item)}
              score={item.vote_average}
              mediaType={item.media_type}
              scoreColor={scoreColor}
              mediaTypeLabel={mediaTypeLabel}
              onClick={() => onOpenWork(item.id, getMediaType(item))}
            />
          ))}
        </ScrollRow>
      </Section>

      {/* Now Playing Section */}
      <Section
        title="上映中"
        emoji="🎬"
        loading={sectionLoading.nowPlaying}
      >
        <ScrollRow>
          {nowPlaying.map(item => (
            <PosterCard
              key={`np-${item.id}`}
              posterPath={item.poster_path}
              title={getTitle(item)}
              year={getYear(item)}
              score={item.vote_average}
              mediaType="movie"
              scoreColor={scoreColor}
              mediaTypeLabel={mediaTypeLabel}
              onClick={() => onOpenWork(item.id, 'movie')}
            />
          ))}
        </ScrollRow>
      </Section>

      {/* Recent Watches Section */}
      <Section
        title="最近の鑑賞"
        emoji="📝"
        loading={sectionLoading.recent}
        emptyMessage={recent.length === 0 && !sectionLoading.recent ? 'まだ鑑賞記録がありません' : undefined}
      >
        <ScrollRow>
          {recent.map((entry, idx) => {
            const movie = entry.movies
            if (!movie) return null
            return (
              <PosterCard
                key={`recent-${entry.tmdb_id}-${idx}`}
                posterPath={movie.poster_path}
                title={movie.title}
                userScore={entry.score}
                mediaType={movie.media_type || entry.media_type}
                scoreColor={scoreColor}
                mediaTypeLabel={mediaTypeLabel}
                onClick={() => onOpenWork(movie.tmdb_id, (movie.media_type || entry.media_type) as 'movie' | 'tv')}
              />
            )
          })}
        </ScrollRow>
      </Section>

      {/* Recommended Section */}
      <Section
        title="おすすめ"
        emoji="✨"
        loading={sectionLoading.recommended}
      >
        <ScrollRow>
          {recommended.map(item => (
            <PosterCard
              key={`rec-${item.id}`}
              posterPath={item.poster_path}
              title={getTitle(item)}
              year={getYear(item)}
              score={item.vote_average}
              mediaType={item.media_type}
              scoreColor={scoreColor}
              mediaTypeLabel={mediaTypeLabel}
              onClick={() => onOpenWork(item.id, getMediaType(item))}
            />
          ))}
        </ScrollRow>
      </Section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section wrapper                                                     */
/* ------------------------------------------------------------------ */

function Section({
  title,
  emoji,
  loading,
  emptyMessage,
  children,
}: {
  title: string
  emoji: string
  loading: boolean
  emptyMessage?: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 16px', marginBottom: 12,
      }}>
        <span style={{ fontSize: 20 }}>{emoji}</span>
        <h2 style={{
          fontSize: 18, fontWeight: 700, color: 'var(--fm-text)', margin: 0,
        }}>
          {title}
        </h2>
      </div>

      {loading ? (
        <SkeletonRow />
      ) : emptyMessage ? (
        <div style={{
          padding: '24px 16px', textAlign: 'center',
          color: 'var(--fm-text-muted)', fontSize: 14,
        }}>
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Horizontal scroll row                                               */
/* ------------------------------------------------------------------ */

function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        overflowX: 'auto',
        overflowY: 'hidden',
        gap: 12,
        padding: '0 16px 8px',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Poster card                                                         */
/* ------------------------------------------------------------------ */

function PosterCard({
  posterPath,
  title,
  year,
  score,
  userScore,
  mediaType,
  scoreColor,
  mediaTypeLabel,
  onClick,
}: {
  posterPath: string | null
  title: string
  year?: string
  score?: number
  userScore?: number | null
  mediaType?: string
  scoreColor: (s: number) => string
  mediaTypeLabel: (t: string) => string
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)

  const displayScore = userScore ?? score
  const hasScore = displayScore != null && displayScore > 0

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        width: 130,
        cursor: 'pointer',
        scrollSnapAlign: 'start',
        transition: 'transform 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
      }}
    >
      <div style={{
        position: 'relative',
        width: 130,
        height: 195,
        borderRadius: 10,
        overflow: 'hidden',
        background: 'var(--fm-bg-card)',
        border: '1px solid var(--fm-border)',
      }}>
        {posterPath && !imgError ? (
          <img
            src={`${TMDB_IMG}/w500${posterPath}`}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--fm-bg-secondary)',
            color: 'var(--fm-text-muted)', fontSize: 32,
          }}>
            🎬
          </div>
        )}

        {/* Score badge */}
        {hasScore && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            borderRadius: 6, padding: '2px 6px',
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 12, fontWeight: 700,
            color: scoreColor(displayScore!),
          }}>
            <span style={{ color: 'var(--fm-star)', fontSize: 10 }}>★</span>
            {userScore != null ? userScore.toFixed(1) : (displayScore! / 2).toFixed(1)}
          </div>
        )}

        {/* Media type badge */}
        {mediaType && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: mediaType === 'tv'
              ? 'rgba(108,92,231,0.85)'
              : 'rgba(46,204,138,0.85)',
            backdropFilter: 'blur(4px)',
            borderRadius: 6, padding: '2px 6px',
            fontSize: 10, fontWeight: 700, color: '#fff',
          }}>
            {mediaTypeLabel(mediaType)}
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, padding: '0 2px' }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--fm-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        {year && (
          <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 2 }}>
            {year}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '0 16px',
      overflowX: 'hidden',
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 130 }}>
          <div style={{
            width: 130, height: 195, borderRadius: 10,
            background: 'var(--fm-bg-card)',
            animation: 'pulse-skeleton 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
          <div style={{
            width: 90, height: 14, borderRadius: 4, marginTop: 8,
            background: 'var(--fm-bg-card)',
            animation: 'pulse-skeleton 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1 + 0.05}s`,
          }} />
          <div style={{
            width: 40, height: 10, borderRadius: 4, marginTop: 4,
            background: 'var(--fm-bg-card)',
            animation: 'pulse-skeleton 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1 + 0.1}s`,
          }} />
          <style>{`
            @keyframes pulse-skeleton {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 0.8; }
            }
          `}</style>
        </div>
      ))}
    </div>
  )
}
