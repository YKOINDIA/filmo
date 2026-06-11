'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { buildTasteProfile, calculateGenreMatchScore, type TasteProfile } from '../lib/matchScore'
import { useTmdbFetch } from '../lib/i18n'
import { supabase } from '../lib/supabase'

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

const GENRE_CHIPS: { label: string; emoji: string; genreId: number }[] = [
  { label: 'アクション', emoji: '💥', genreId: 28 },
  { label: 'コメディ', emoji: '😂', genreId: 35 },
  { label: 'ドラマ', emoji: '🎭', genreId: 18 },
  { label: 'ホラー', emoji: '👻', genreId: 27 },
  { label: 'SF', emoji: '🚀', genreId: 878 },
  { label: 'ロマンス', emoji: '💕', genreId: 10749 },
  { label: 'アニメ', emoji: '🎨', genreId: 16 },
  { label: 'ミステリー', emoji: '🔍', genreId: 9648 },
  { label: 'ファンタジー', emoji: '🧙', genreId: 14 },
  { label: 'ドキュメンタリー', emoji: '📹', genreId: 99 },
  { label: 'スリラー', emoji: '😱', genreId: 53 },
  { label: '音楽', emoji: '🎵', genreId: 10402 },
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

  // プロフィール属性ベースのレコメンド (世代+地域で観た可能性が高い作品)
  const [forYou, setForYou] = useState<MediaItem[]>([])
  const [forYouLoading, setForYouLoading] = useState(true)
  const [forYouLabel, setForYouLabel] = useState<string>('')

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

  // プロフィール属性 → 世代+地域ベースのレコメンドを取得
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: u } = await supabase
          .from('users')
          .select('birth_year, country')
          .eq('id', userId)
          .maybeSingle()
        if (cancelled) return
        if (!u || !u.birth_year) {
          // プロフィール未入力 → セクション非表示
          setForYouLoading(false)
          return
        }

        const birthYear = u.birth_year as number
        const country = u.country as string | null
        const startYear = birthYear + 8
        const endYear = Math.min(birthYear + 25, new Date().getFullYear())
        const decadeLabel = `${Math.floor(startYear / 10) * 10}s〜${Math.floor(endYear / 10) * 10}s`

        const params = new URLSearchParams({
          action: 'discover',
          type: 'movie',
          'primary_release_date.gte': `${startYear}-01-01`,
          'primary_release_date.lte': `${endYear}-12-31`,
          sort_by: 'popularity.desc',
          'vote_count.gte': '200',
        })
        if (country && country.length === 2) {
          params.set('with_origin_country', country)
        }
        const res = await tmdbFetch(`/api/tmdb?${params.toString()}`)
        if (!res.ok) {
          setForYouLoading(false)
          return
        }
        const data = await res.json()

        // 既に観たマークが付いているものを除外
        const { data: watched } = await supabase
          .from('watchlists')
          .select('movie_id')
          .eq('user_id', userId)
          .eq('status', 'watched')
        const watchedSet = new Set(
          ((watched || []) as { movie_id: number }[]).map(w => w.movie_id)
        )

        const filtered: MediaItem[] = (data.results || [])
          .filter((m: MediaItem) => !watchedSet.has(m.id) && m.poster_path)
          .slice(0, 20)

        if (!cancelled) {
          setForYou(filtered)
          setForYouLabel(country === 'JP' || !country
            ? `あなたの世代の名作 (${decadeLabel})`
            : `あなたの世代×地域の名作 (${decadeLabel})`
          )
          setForYouLoading(false)
        }
      } catch {
        if (!cancelled) setForYouLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId, tmdbFetch])

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

      {/* あなたへのおすすめ (プロフィール属性ベース) */}
      {!forYouLoading && forYou.length > 0 && (
        <Section
          title={forYouLabel}
          emoji="✨"
          loading={false}
        >
          <ScrollRow>
            {forYou.map(item => (
              <PosterCard
                key={`foryou-${item.id}`}
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
      )}

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

      {/* 人物で探す */}
      <section style={{ padding: '0 24px', marginTop: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>👤</span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>
            人物で探す
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/directors" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(108,92,231,0.15)',
            border: '1px solid rgba(108,92,231,0.35)',
            borderRadius: 24, padding: '10px 22px',
            fontSize: 14, fontWeight: 700, color: '#a29bfe',
            textDecoration: 'none', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 18 }}>🎬</span>
            監督一覧
          </Link>
          <Link href="/screenwriters" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(46,204,138,0.15)',
            border: '1px solid rgba(46,204,138,0.35)',
            borderRadius: 24, padding: '10px 22px',
            fontSize: 14, fontWeight: 700, color: '#2ecc8a',
            textDecoration: 'none', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 18 }}>✍️</span>
            脚本家一覧
          </Link>
        </div>
      </section>

      {/* 🌌 Filmo Universe — 占い・ミニゲーム・今後展開のサブサービス群を統合 */}
      <FilmoUniverseSection />

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
            <Link
              key={genre.label}
              href={`/?tab=search&genre=${genre.genreId}&label=${encodeURIComponent(genre.label)}`}
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
                textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 16 }}>{genre.emoji}</span>
              {genre.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Filmo Universe — 映画体験を広げるサブサービスのハブ                  */
/* ------------------------------------------------------------------ */

const UNIVERSE_COMING_SOON: { emoji: string; title: string; subtitle: string; accent: string }[] = [
  {
    emoji: '📚',
    title: 'Filmo Study',
    subtitle: '映画で英語・教養を学ぶ',
    accent: 'rgba(59,130,246,0.5)',
  },
  {
    emoji: '💄',
    title: 'Filmo Beauty',
    subtitle: '女優のメイク・衣装トレンド',
    accent: 'rgba(236,72,153,0.5)',
  },
]

function FilmoUniverseSection() {
  return (
    <section style={{ padding: '0 24px', marginTop: 28, marginBottom: 16 }}>
      <style>{`
        @keyframes universe-twinkle {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes universe-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .universe-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .universe-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .universe-title {
          background: linear-gradient(90deg, #fff 0%, #FFD24A 35%, #ff7aae 70%, #a29bfe 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: universe-shimmer 6s linear infinite;
        }
        .universe-star {
          position: absolute;
          background: #fff;
          border-radius: 50%;
          animation: universe-twinkle 3s ease-in-out infinite;
        }
      `}</style>

      {/* ===== Universe Banner Header ===== */}
      <div style={{
        borderRadius: 18,
        padding: '22px 20px 20px',
        marginBottom: 16,
        background: 'linear-gradient(135deg, #1a0b2e 0%, #2d1b4e 45%, #3d1a3d 100%)',
        border: '1px solid rgba(195,116,255,0.35)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Star particles */}
        <span className="universe-star" style={{ width: 2, height: 2, top: '20%', left: '12%', animationDelay: '0s' }} />
        <span className="universe-star" style={{ width: 3, height: 3, top: '60%', left: '88%', animationDelay: '0.8s', background: '#FFD24A' }} />
        <span className="universe-star" style={{ width: 2, height: 2, top: '35%', left: '55%', animationDelay: '1.5s' }} />
        <span className="universe-star" style={{ width: 2, height: 2, top: '75%', left: '30%', animationDelay: '2.1s', background: '#ff7aae' }} />
        <span className="universe-star" style={{ width: 2, height: 2, top: '15%', left: '78%', animationDelay: '1.2s' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>🌌</span>
            <h2 className="universe-title" style={{
              fontSize: 22,
              fontWeight: 900,
              margin: 0,
              letterSpacing: 0.5,
            }}>
              Filmo Universe
            </h2>
          </div>
          <div style={{ fontSize: 13, color: '#cfc6e0', lineHeight: 1.5 }}>
            映画から広がる、もっと楽しい毎日。占い・ゲーム・学び・ビューティ。
          </div>
        </div>
      </div>

      {/* ===== うらにゃん。— featured 大カード ===== */}
      <Link
        href="/games/uranyan"
        className="universe-card"
        style={{
          display: 'block',
          padding: 18,
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(255,122,174,0.28), rgba(195,116,255,0.22))',
          border: '1px solid rgba(255,122,174,0.4)',
          textDecoration: 'none',
          color: 'inherit',
          marginBottom: 18,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 36 }}>🐱🐶</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: '#FFD24A',
                background: 'rgba(255,210,74,0.15)',
                border: '1px solid rgba(255,210,74,0.35)',
                borderRadius: 4, padding: '2px 6px', letterSpacing: 0.5,
              }}>🔮 占い</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
              うらにゃん。
            </div>
            <div style={{ fontSize: 12, color: '#ddd', marginTop: 4, lineHeight: 1.5 }}>
              算命学×宿曜で性格・相性診断。<br />友達・家族・推しの生年月日を登録して占おう
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#FFD24A' }}>→</div>
        </div>
      </Link>

      {/* ===== Filmo Games — 4ゲームをハブ /games に集約 ===== */}
      <Link
        href="/games"
        className="universe-card"
        style={{
          display: 'block',
          padding: 18,
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(108,92,231,0.22), rgba(255,210,74,0.16) 60%, rgba(99,102,241,0.20))',
          border: '1px solid rgba(195,116,255,0.35)',
          textDecoration: 'none',
          color: 'inherit',
          marginBottom: 18,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32 }}>🎮</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: '#a29bfe',
                background: 'rgba(108,92,231,0.18)',
                border: '1px solid rgba(108,92,231,0.4)',
                borderRadius: 4, padding: '2px 6px', letterSpacing: 0.5,
              }}>🎮 ゲーム</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
              Filmo Games
            </div>
            <div style={{ fontSize: 12, color: '#ddd', marginTop: 4, lineHeight: 1.5 }}>
              5種のミニゲームでスコアを競おう
            </div>
            <div style={{
              display: 'flex', gap: 8, marginTop: 10,
              fontSize: 20, opacity: 0.85,
            }}>
              <span title="絵文字タイトル当て">🚢💎</span>
              <span title="CRYSTAL BLAST">💎</span>
              <span title="FILMIUS">🚀</span>
              <span title="FILMAPPY">🎞️</span>
              <span title="Minesweeper">💣</span>
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#FFD24A' }}>→</div>
        </div>
      </Link>

      {/* ===== Filmo Agey — 年齢メモ ===== */}
      <Link
        href="/agey"
        className="universe-card"
        style={{
          display: 'block',
          padding: 18,
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(124,196,255,0.22), rgba(162,155,254,0.20))',
          border: '1px solid rgba(124,196,255,0.4)',
          textDecoration: 'none',
          color: 'inherit',
          marginBottom: 18,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32 }}>👶</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: '#7cc4ff',
                background: 'rgba(124,196,255,0.15)',
                border: '1px solid rgba(124,196,255,0.4)',
                borderRadius: 4, padding: '2px 6px', letterSpacing: 0.5,
              }}>👶 人物メモ</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
              Filmo Agey
            </div>
            <div style={{ fontSize: 12, color: '#ddd', marginTop: 4, lineHeight: 1.5 }}>
              仲間や子供の友達の名前・間柄・年齢をメモ。<br />誕生日がわかる人は正確な年齢を自動計算
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#7cc4ff' }}>→</div>
        </div>
      </Link>

      {/* ===== Filmo ファスティング — 断食コミュニティ ===== */}
      <Link
        href="/fasting"
        className="universe-card"
        style={{
          display: 'block',
          padding: 18,
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(79,209,165,0.22), rgba(124,196,255,0.18))',
          border: '1px solid rgba(79,209,165,0.4)',
          textDecoration: 'none',
          color: 'inherit',
          marginBottom: 18,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32 }}>🍃</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: '#4fd1a5',
                background: 'rgba(79,209,165,0.15)',
                border: '1px solid rgba(79,209,165,0.4)',
                borderRadius: 4, padding: '2px 6px', letterSpacing: 0.5,
              }}>🍃 ファスティング</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
              Filmo ファスティング
            </div>
            <div style={{ fontSize: 12, color: '#ddd', marginTop: 4, lineHeight: 1.5 }}>
              仲間とゲーム感覚で断食を継続。<br />いま頑張る仲間が見え、回復食を称え合える
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#4fd1a5' }}>→</div>
        </div>
      </Link>

      {/* ===== Filmo Fable 5 — AIの政策提言 ===== */}
      <Link
        href="/fable5"
        className="universe-card"
        style={{
          display: 'block',
          padding: 18,
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(255,210,74,0.20), rgba(255,87,87,0.16) 60%, rgba(124,196,255,0.18))',
          border: '1px solid rgba(255,210,74,0.4)',
          textDecoration: 'none',
          color: 'inherit',
          marginBottom: 18,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: '#ffd24a',
                background: 'rgba(255,210,74,0.15)',
                border: '1px solid rgba(255,210,74,0.35)',
                borderRadius: 4, padding: '2px 6px', letterSpacing: 0.5,
              }}>🏛️ AIの政策提言</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
              Filmo Fable 5
            </div>
            <div style={{ fontSize: 12, color: '#ddd', marginTop: 4, lineHeight: 1.5 }}>
              AIが本気で考えた政策提言と未来シナリオ。<br />幸せになる政策 × 最強になる政策 × 宇宙の未来
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#ffd24a' }}>→</div>
        </div>
      </Link>

      {/* ===== Coming Soon ===== */}
      <SubHeader emoji="✨" label="Coming Soon" />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
      }}>
        {UNIVERSE_COMING_SOON.map(s => (
          <div
            key={s.title}
            style={{
              padding: 14,
              borderRadius: 14,
              background: 'rgba(20,22,40,0.6)',
              border: `1px dashed ${s.accent}`,
              textAlign: 'center',
              opacity: 0.85,
              position: 'relative',
            }}>
            <div style={{
              position: 'absolute', top: 8, right: 8,
              fontSize: 9, fontWeight: 800, color: '#fff',
              background: s.accent, borderRadius: 4, padding: '2px 6px',
              letterSpacing: 0.5,
            }}>SOON</div>
            <div style={{ fontSize: 32, marginBottom: 6, filter: 'grayscale(0.2)' }}>{s.emoji}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{s.title}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 3, lineHeight: 1.4 }}>
              {s.subtitle}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SubHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <h3 style={{
        fontSize: 14, fontWeight: 800, color: '#cfc6e0',
        margin: 0, letterSpacing: 0.5, textTransform: 'uppercase',
      }}>
        {label}
      </h3>
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(90deg, rgba(195,116,255,0.25), transparent)',
        marginLeft: 4,
      }} />
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
