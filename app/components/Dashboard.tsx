'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { buildTasteProfile, calculateGenreMatchScore, type TasteProfile } from '../lib/matchScore'
import { useTmdbFetch } from '../lib/i18n'

const TMDB_IMG_POSTER = 'https://image.tmdb.org/t/p/w342'
const TMDB_IMG_BACKDROP = 'https://image.tmdb.org/t/p/w1280'

interface DashboardProps {
  userId: string
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}

interface MediaItem {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path?: string | null
  media_type?: string
  vote_average?: number
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
}

const GENRE_CHIPS: { label: string; emoji: string }[] = [
  { label: 'アクション', emoji: '💥' },
  { label: 'コメディ', emoji: '😂' },
  { label: 'ドラマ', emoji: '🎭' },
  { label: 'ホラー', emoji: '👻' },
  { label: 'SF', emoji: '🚀' },
  { label: 'ロマンス', emoji: '💕' },
  { label: 'アニメ', emoji: '🎨' },
  { label: 'ミステリー', emoji: '🔍' },
  { label: 'ファンタジー', emoji: '🧙' },
  { label: 'ドキュメンタリー', emoji: '📹' },
  { label: 'スリラー', emoji: '😱' },
  { label: '音楽', emoji: '🎵' },
]

interface SectionLoadingState {
  trending: boolean
  nowPlaying: boolean
  upcoming: boolean
  tvDramas: boolean
  anime: boolean
}

export default function Dashboard({ userId, onOpenWork }: DashboardProps) {
  const tmdbFetch = useTmdbFetch()
  const [trending, setTrending] = useState<MediaItem[]>([])
  const [nowPlaying, setNowPlaying] = useState<MediaItem[]>([])
  const [upcoming, setUpcoming] = useState<MediaItem[]>([])
  const [tvDramas, setTvDramas] = useState<MediaItem[]>([])
  const [anime, setAnime] = useState<MediaItem[]>([])
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sectionLoading, setSectionLoading] = useState<SectionLoadingState>({
    trending: true,
    nowPlaying: true,
    upcoming: true,
    tvDramas: true,
    anime: true,
  })

  const fetchTrending = useCallback(async () => {
    try {
      const res = await tmdbFetch('/api/tmdb?action=trending')
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
      const res = await tmdbFetch('/api/tmdb?action=now_playing')
      if (!res.ok) throw new Error('Failed to fetch now playing')
      const data = await res.json()
      setNowPlaying(data.results || [])
    } catch (err) {
      console.error('Now playing fetch error:', err)
    } finally {
      setSectionLoading(prev => ({ ...prev, nowPlaying: false }))
    }
  }, [])

  const fetchUpcoming = useCallback(async () => {
    try {
      const res = await tmdbFetch('/api/tmdb?action=upcoming')
      if (!res.ok) throw new Error('Failed to fetch upcoming')
      const data = await res.json()
      setUpcoming(data.results || [])
    } catch (err) {
      console.error('Upcoming fetch error:', err)
    } finally {
      setSectionLoading(prev => ({ ...prev, upcoming: false }))
    }
  }, [])

  const fetchTvDramas = useCallback(async () => {
    try {
      const res = await tmdbFetch('/api/tmdb?action=discover&type=tv')
      if (!res.ok) throw new Error('Failed to fetch TV dramas')
      const data = await res.json()
      setTvDramas(data.results || [])
    } catch (err) {
      console.error('TV dramas fetch error:', err)
    } finally {
      setSectionLoading(prev => ({ ...prev, tvDramas: false }))
    }
  }, [])

  const fetchAnime = useCallback(async () => {
    try {
      const res = await tmdbFetch('/api/tmdb?action=discover&type=tv&with_genres=16')
      if (!res.ok) throw new Error('Failed to fetch anime')
      const data = await res.json()
      setAnime(data.results || [])
    } catch (err) {
      console.error('Anime fetch error:', err)
    } finally {
      setSectionLoading(prev => ({ ...prev, anime: false }))
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetchTrending(),
      fetchNowPlaying(),
      fetchUpcoming(),
      fetchTvDramas(),
      fetchAnime(),
    ]).finally(() => setLoading(false))
  }, [fetchTrending, fetchNowPlaying, fetchUpcoming, fetchTvDramas, fetchAnime])

  useEffect(() => {
    buildTasteProfile(userId).then(setTasteProfile)
  }, [userId])

  const getTitle = (item: MediaItem): string => item.title || item.name || ''
  const getYear = (item: MediaItem): string => {
    const d = item.release_date || item.first_air_date
    return d ? d.slice(0, 4) : ''
  }
  const getMediaType = (item: MediaItem): 'movie' | 'tv' => {
    if (item.media_type === 'tv') return 'tv'
    if (item.name && !item.title) return 'tv'
    return 'movie'
  }
  const toFilmoScore = (tmdbScore: number): string => (tmdbScore / 2).toFixed(1)

  const getMatchScore = (item: MediaItem): number | null => {
    if (!tasteProfile || !item.genre_ids?.length) return null
    return calculateGenreMatchScore(tasteProfile, item.genre_ids)
  }

  const heroItem = trending.length > 0 ? trending[0] : null

  return (
    <div style={{
      background: '#0a0b14',
      minHeight: '100vh',
      paddingBottom: 60,
      color: '#e0e0e0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <style>{`
        @keyframes pulse-skeleton {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .filmo-scroll-row::-webkit-scrollbar { display: none; }
        .filmo-poster-card:hover { transform: translateY(-6px) scale(1.03) !important; }
        .filmo-genre-chip:hover {
          background: var(--fm-accent) !important;
          transform: scale(1.05) !important;
          color: #fff !important;
          border-color: var(--fm-accent) !important;
        }
        .filmo-hero-btn:hover {
          background: var(--fm-accent-light) !important;
          transform: scale(1.05) !important;
        }
        .filmo-more-link:hover {
          color: var(--fm-accent-light) !important;
        }
      `}</style>

      {/* Hero Section - 注目セクション */}
      {sectionLoading.trending ? (
        <div style={{
          width: '100%',
          height: 420,
          background: '#12132a',
          animation: 'pulse-skeleton 1.5s ease-in-out infinite',
        }} />
      ) : heroItem ? (
        <div
          onClick={() => onOpenWork(heroItem.id, getMediaType(heroItem))}
          style={{
            position: 'relative',
            width: '100%',
            height: 420,
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          {heroItem.backdrop_path && (
            <img
              src={`${TMDB_IMG_BACKDROP}${heroItem.backdrop_path}`}
              alt={getTitle(heroItem)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          )}
          {/* Gradient overlays */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, #0a0b14 0%, rgba(10,11,20,0.7) 40%, rgba(10,11,20,0.2) 70%, rgba(10,11,20,0.4) 100%)',
          }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, rgba(10,11,20,0.8) 0%, transparent 60%)',
          }} />

          {/* Hero content */}
          <div style={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            padding: '0 32px',
            animation: 'fadeInUp 0.8s ease-out',
          }}>
            <div style={{
              display: 'inline-block',
              background: 'var(--fm-accent)',
              borderRadius: 6,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 12,
              letterSpacing: 1,
            }}>
              🔥 注目
            </div>
            <h1 style={{
              fontSize: 32,
              fontWeight: 800,
              color: '#fff',
              margin: '0 0 10px 0',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              lineHeight: 1.2,
              maxWidth: 600,
            }}>
              {getTitle(heroItem)}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {heroItem.vote_average != null && heroItem.vote_average > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 8,
                  padding: '6px 14px',
                }}>
                  <span style={{ color: '#ffd700', fontSize: 18 }}>★</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#ffd700' }}>
                    {toFilmoScore(heroItem.vote_average)}
                  </span>
                  <span style={{ fontSize: 13, color: '#aaa', marginLeft: 2 }}>/ 5.0</span>
                </div>
              )}
              {getYear(heroItem) && (
                <span style={{ fontSize: 14, color: '#bbb' }}>{getYear(heroItem)}</span>
              )}
            </div>
            <button
              className="filmo-hero-btn"
              onClick={(e) => {
                e.stopPropagation()
                onOpenWork(heroItem.id, getMediaType(heroItem))
              }}
              style={{
                background: 'var(--fm-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(0,192,48,0.3)',
              }}
            >
              詳細を見る
            </button>
          </div>
        </div>
      ) : null}

      {/* 今注目の作品 */}
      <Section
        title="今注目の作品"
        emoji="🔥"
        loading={sectionLoading.trending}
      >
        <ScrollRow>
          {trending.slice(1).map(item => (
            <PosterCard
              key={`trending-${item.id}`}
              posterPath={item.poster_path}
              title={getTitle(item)}
              year={getYear(item)}
              voteAverage={item.vote_average}
              matchScore={getMatchScore(item)}
              onClick={() => onOpenWork(item.id, getMediaType(item))}
            />
          ))}
        </ScrollRow>
      </Section>

      {/* 上映中の映画 */}
      <Section
        title="上映中の映画"
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
              voteAverage={item.vote_average}
              matchScore={getMatchScore(item)}
              onClick={() => onOpenWork(item.id, 'movie')}
            />
          ))}
        </ScrollRow>
      </Section>

      {/* 公開予定の映画 */}
      <Section
        title="公開予定の映画"
        emoji="📅"
        loading={sectionLoading.upcoming}
      >
        <ScrollRow>
          {upcoming.map(item => (
            <PosterCard
              key={`up-${item.id}`}
              posterPath={item.poster_path}
              title={getTitle(item)}
              year={getYear(item)}
              voteAverage={item.vote_average}
              matchScore={getMatchScore(item)}
              onClick={() => onOpenWork(item.id, 'movie')}
            />
          ))}
        </ScrollRow>
      </Section>

      {/* 人気のドラマ */}
      <Section
        title="人気のドラマ"
        emoji="📺"
        loading={sectionLoading.tvDramas}
      >
        <ScrollRow>
          {tvDramas.map(item => (
            <PosterCard
              key={`tv-${item.id}`}
              posterPath={item.poster_path}
              title={getTitle(item)}
              year={getYear(item)}
              voteAverage={item.vote_average}
              matchScore={getMatchScore(item)}
              onClick={() => onOpenWork(item.id, 'tv')}
            />
          ))}
        </ScrollRow>
      </Section>

      {/* 人気のアニメ */}
      <Section
        title="人気のアニメ"
        emoji="🎨"
        loading={sectionLoading.anime}
      >
        <ScrollRow>
          {anime.map(item => (
            <PosterCard
              key={`anime-${item.id}`}
              posterPath={item.poster_path}
              title={getTitle(item)}
              year={getYear(item)}
              voteAverage={item.vote_average}
              matchScore={getMatchScore(item)}
              onClick={() => onOpenWork(item.id, 'tv')}
            />
          ))}
        </ScrollRow>
      </Section>

      {/* ジャンルで探す */}
      <section style={{ padding: '0 24px', marginTop: 12, marginBottom: 32 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 22 }}>🏷️</span>
          <h2 style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#fff',
            margin: 0,
          }}>
            ジャンルで探す
          </h2>
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          {GENRE_CHIPS.map(genre => (
            <button
              key={genre.label}
              className="filmo-genre-chip"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(0,192,48,0.12)',
                border: '1px solid rgba(0,192,48,0.25)',
                borderRadius: 24,
                padding: '8px 18px',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--fm-accent-light)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 16 }}>{genre.emoji}</span>
              {genre.label}
            </button>
          ))}
        </div>
      </section>
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
  children,
}: {
  title: string
  emoji: string
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <section style={{ marginTop: 28, marginBottom: 8 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        marginBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{emoji}</span>
          <h2 style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#fff',
            margin: 0,
          }}>
            {title}
          </h2>
        </div>
        <span
          className="filmo-more-link"
          style={{
            fontSize: 13,
            color: 'var(--fm-accent)',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'color 0.2s',
          }}
        >
          もっと見る →
        </span>
      </div>

      {loading ? <SkeletonRow /> : children}
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
      className="filmo-scroll-row"
      style={{
        display: 'flex',
        overflowX: 'auto',
        overflowY: 'hidden',
        gap: 14,
        padding: '0 24px 12px',
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
  voteAverage,
  matchScore,
  onClick,
}: {
  posterPath: string | null
  title: string
  year?: string
  voteAverage?: number
  matchScore?: number | null
  onClick: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const filmoScore = voteAverage != null && voteAverage > 0 ? (voteAverage / 2) : null

  return (
    <div
      className="filmo-poster-card"
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 140,
        cursor: 'pointer',
        scrollSnapAlign: 'start',
        transition: 'transform 0.25s ease',
      }}
    >
      <div style={{
        position: 'relative',
        width: 140,
        height: 210,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#12132a',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        {posterPath && !imgError ? (
          <img
            src={`${TMDB_IMG_POSTER}${posterPath}`}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #12132a, #1e1f3a)',
            color: '#555',
            fontSize: 36,
          }}>
            🎬
          </div>
        )}

        {/* Score badge */}
        {filmoScore !== null && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(6px)',
            borderRadius: 8,
            padding: '3px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 800,
          }}>
            <span style={{ color: '#ffd700', fontSize: 11 }}>★</span>
            <span style={{ color: '#ffd700' }}>{filmoScore.toFixed(1)}</span>
          </div>
        )}

        {/* Match score badge */}
        {matchScore != null && (
          <div style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: matchScore >= 80
              ? 'rgba(46,204,138,0.9)'
              : matchScore >= 65
                ? 'var(--fm-accent)'
                : 'rgba(230,126,34,0.85)',
            backdropFilter: 'blur(6px)',
            borderRadius: 8,
            padding: '3px 7px',
            fontSize: 11,
            fontWeight: 800,
            color: '#fff',
          }}>
            {matchScore}%
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, padding: '0 2px' }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#e0e0e0',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}>
          {title}
        </div>
        {year && (
          <div style={{
            fontSize: 11,
            color: '#777',
            marginTop: 3,
          }}>
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
      display: 'flex',
      gap: 14,
      padding: '0 24px',
      overflowX: 'hidden',
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 140 }}>
          <div style={{
            width: 140,
            height: 210,
            borderRadius: 12,
            background: '#12132a',
            animation: 'pulse-skeleton 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }} />
          <div style={{
            width: 100,
            height: 14,
            borderRadius: 6,
            marginTop: 10,
            background: '#12132a',
            animation: 'pulse-skeleton 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.12 + 0.06}s`,
          }} />
          <div style={{
            width: 45,
            height: 10,
            borderRadius: 4,
            marginTop: 5,
            background: '#12132a',
            animation: 'pulse-skeleton 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.12 + 0.12}s`,
          }} />
        </div>
      ))}
    </div>
  )
}
