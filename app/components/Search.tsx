'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

type TabKey = 'movie' | 'drama' | 'anime'

interface TMDBItem {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  media_type?: string
  release_date?: string
  first_air_date?: string
  vote_average: number
  overview: string
  genre_ids: number[]
}

interface SectionData {
  title: string
  items: TMDBItem[]
  loading: boolean
}

interface BrowseState {
  mode: 'home' | 'genre' | 'year'
  label: string
  items: TMDBItem[]
  loading: boolean
  page: number
  totalPages: number
}

const MOVIE_GENRES = [
  { id: 28, name: 'アクション', emoji: '💥' },
  { id: 12, name: 'アドベンチャー', emoji: '🗺️' },
  { id: 35, name: 'コメディ', emoji: '😂' },
  { id: 80, name: '犯罪', emoji: '🔫' },
  { id: 99, name: 'ドキュメンタリー', emoji: '📹' },
  { id: 18, name: 'ドラマ', emoji: '🎭' },
  { id: 10751, name: 'ファミリー', emoji: '👨‍👩‍👧' },
  { id: 14, name: 'ファンタジー', emoji: '🧙' },
  { id: 36, name: '歴史', emoji: '📜' },
  { id: 27, name: 'ホラー', emoji: '👻' },
  { id: 10402, name: '音楽', emoji: '🎵' },
  { id: 9648, name: 'ミステリー', emoji: '🔍' },
  { id: 10749, name: 'ロマンス', emoji: '💕' },
  { id: 878, name: 'SF', emoji: '🚀' },
  { id: 53, name: 'スリラー', emoji: '😱' },
  { id: 10752, name: '戦争', emoji: '⚔️' },
  { id: 37, name: '西部劇', emoji: '🤠' },
]

const TV_GENRES = [
  { id: 10759, name: 'アクション＆アドベンチャー', emoji: '💥' },
  { id: 35, name: 'コメディ', emoji: '😂' },
  { id: 80, name: '犯罪', emoji: '🔫' },
  { id: 99, name: 'ドキュメンタリー', emoji: '📹' },
  { id: 18, name: 'ドラマ', emoji: '🎭' },
  { id: 10751, name: 'ファミリー', emoji: '👨‍👩‍👧' },
  { id: 9648, name: 'ミステリー', emoji: '🔍' },
  { id: 10749, name: 'ロマンス', emoji: '💕' },
  { id: 10765, name: 'SF＆ファンタジー', emoji: '🚀' },
  { id: 10768, name: '戦争＆政治', emoji: '⚔️' },
]

const ANIME_GENRES = [
  { id: 10759, name: 'アクション', emoji: '💥' },
  { id: 35, name: 'コメディ', emoji: '😂' },
  { id: 18, name: 'ドラマ', emoji: '🎭' },
  { id: 10765, name: 'SF＆ファンタジー', emoji: '🚀' },
  { id: 10749, name: 'ロマンス', emoji: '💕' },
  { id: 9648, name: 'ミステリー', emoji: '🔍' },
]

const DECADES = [
  { label: '2020年代', gte: '2020-01-01', lte: '2029-12-31' },
  { label: '2010年代', gte: '2010-01-01', lte: '2019-12-31' },
  { label: '2000年代', gte: '2000-01-01', lte: '2009-12-31' },
  { label: '1990年代', gte: '1990-01-01', lte: '1999-12-31' },
  { label: '1980年代', gte: '1980-01-01', lte: '1989-12-31' },
  { label: '1970年代', gte: '1970-01-01', lte: '1979-12-31' },
]

const TABS: { key: TabKey; label: string }[] = [
  { key: 'movie', label: '映画' },
  { key: 'drama', label: 'ドラマ' },
  { key: 'anime', label: 'アニメ' },
]

// Styles
const S = {
  page: {
    padding: '0 0 32px',
    background: '#0a0b14',
    minHeight: '100vh',
    color: '#e0e0f0',
  } as React.CSSProperties,
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #1e1f36',
    marginBottom: 0,
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
    background: '#0a0b14',
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '14px 0',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: active ? 700 : 500,
    color: active ? '#a29bfe' : '#8888a8',
    background: 'none',
    border: 'none',
    borderBottom: active ? '3px solid #6c5ce7' : '3px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }),
  searchWrap: {
    padding: '16px 16px 0',
    marginBottom: 16,
  } as React.CSSProperties,
  searchInput: {
    width: '100%',
    padding: '13px 16px 13px 44px',
    borderRadius: 12,
    border: '1px solid #2a2b46',
    background: '#12132a',
    color: '#e0e0f0',
    fontSize: 15,
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,
  searchIcon: {
    position: 'absolute' as const,
    left: 30,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 18,
    color: '#6c5ce7',
    pointerEvents: 'none' as const,
  } as React.CSSProperties,
  clearBtn: {
    position: 'absolute' as const,
    right: 28,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#8888a8',
    cursor: 'pointer',
    fontSize: 20,
    lineHeight: 1,
    padding: 4,
  } as React.CSSProperties,
  sectionHeader: {
    fontSize: 16,
    fontWeight: 700,
    padding: '20px 16px 10px',
    color: '#e0e0f0',
  } as React.CSSProperties,
  scrollRow: {
    display: 'flex',
    overflowX: 'auto' as const,
    overflowY: 'hidden' as const,
    gap: 12,
    padding: '0 16px 8px',
    scrollbarWidth: 'none' as const,
  } as React.CSSProperties,
  posterCard: {
    flexShrink: 0,
    width: 130,
    cursor: 'pointer',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#12132a',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  } as React.CSSProperties,
  posterImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  } as React.CSSProperties,
  noImg: {
    width: '100%',
    height: '100%',
    background: '#1a1b36',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    color: '#4a4b66',
  } as React.CSSProperties,
  badge: (type: 'movie' | 'tv'): React.CSSProperties => ({
    position: 'absolute',
    top: 6,
    left: 6,
    padding: '2px 6px',
    borderRadius: 4,
    background: type === 'movie' ? 'rgba(108,92,231,0.9)' : 'rgba(46,204,138,0.9)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
  }),
  score: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'rgba(0,0,0,0.75)',
    color: '#ffd700',
    fontSize: 11,
    fontWeight: 700,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e0e0f0',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  cardSub: {
    fontSize: 11,
    color: '#8888a8',
  } as React.CSSProperties,
  genreGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8,
    padding: '0 16px 8px',
  } as React.CSSProperties,
  genrePill: (selected: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 24,
    border: `1px solid ${selected ? '#6c5ce7' : '#2a2b46'}`,
    background: selected ? 'rgba(108,92,231,0.2)' : '#12132a',
    color: selected ? '#a29bfe' : '#c0c0d8',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  }),
  decadeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8,
    padding: '0 16px 8px',
  } as React.CSSProperties,
  decadePill: {
    padding: '10px 14px',
    borderRadius: 24,
    border: '1px solid #2a2b46',
    background: '#12132a',
    color: '#c0c0d8',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: 12,
    padding: '0 16px',
  } as React.CSSProperties,
  gridCard: {
    cursor: 'pointer',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#12132a',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  } as React.CSSProperties,
  loadMoreBtn: {
    display: 'block',
    margin: '20px auto 0',
    padding: '12px 40px',
    borderRadius: 24,
    border: '1px solid #6c5ce7',
    background: 'transparent',
    color: '#a29bfe',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    margin: '16px 16px 0',
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid #2a2b46',
    background: '#12132a',
    color: '#a29bfe',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  skeleton: {
    aspectRatio: '2/3',
    background: 'linear-gradient(110deg, #12132a 30%, #1e1f36 50%, #12132a 70%)',
    backgroundSize: '200% 100%',
    borderRadius: 10,
    animation: 'shimmer 1.5s infinite linear',
  } as React.CSSProperties,
  emptyState: {
    textAlign: 'center' as const,
    padding: '48px 20px',
    color: '#8888a8',
  } as React.CSSProperties,
} as const

export default function Search({ userId, onOpenWork }: {
  userId: string
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('movie')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TMDBItem[]>([])
  const [searchPage, setSearchPage] = useState(1)
  const [searchTotalPages, setSearchTotalPages] = useState(1)
  const [searchLoading, setSearchLoading] = useState(false)

  // Section data for browsing
  const [sections, setSections] = useState<Record<string, SectionData>>({})

  // Browse state for genre/year drill-down
  const [browse, setBrowse] = useState<BrowseState>({
    mode: 'home', label: '', items: [], loading: false, page: 1, totalPages: 1,
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // --- Helpers ---
  const getTitle = (r: TMDBItem): string => r.title || r.name || ''
  const getYear = (r: TMDBItem): string => (r.release_date || r.first_air_date || '').substring(0, 4)
  const getType = (r: TMDBItem): 'movie' | 'tv' => r.media_type === 'movie' ? 'movie' : 'tv'
  const formatScore = (v: number): string => (v / 2).toFixed(1)

  // --- Fetchers ---
  const fetchSection = useCallback(async (key: string, title: string, url: string, mediaType?: 'movie' | 'tv') => {
    setSections(prev => ({ ...prev, [key]: { title, items: prev[key]?.items || [], loading: true } }))
    try {
      const res = await fetch(url)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || mediaType || 'movie',
      }))
      setSections(prev => ({ ...prev, [key]: { title, items, loading: false } }))
    } catch {
      setSections(prev => ({ ...prev, [key]: { title, items: [], loading: false } }))
    }
  }, [])

  // Load sections when tab changes
  useEffect(() => {
    if (debouncedQuery || browse.mode !== 'home') return
    setSections({})

    if (activeTab === 'movie') {
      fetchSection('trending_movie', '今注目の映画', '/api/tmdb?action=trending&media_type=movie', 'movie')
      fetchSection('now_playing', '上映中', '/api/tmdb?action=now_playing', 'movie')
      fetchSection('upcoming', '公開予定', '/api/tmdb?action=upcoming', 'movie')
    } else if (activeTab === 'drama') {
      fetchSection('trending_tv', '今注目のドラマ', '/api/tmdb?action=trending&media_type=tv', 'tv')
      fetchSection('jp_drama', '日本のドラマ', '/api/tmdb?action=discover&type=tv&with_origin_country=JP&sort_by=popularity.desc', 'tv')
      fetchSection('kr_drama', '韓国ドラマ', '/api/tmdb?action=discover&type=tv&with_origin_country=KR&sort_by=popularity.desc', 'tv')
      fetchSection('us_drama', '海外ドラマ', '/api/tmdb?action=discover&type=tv&with_origin_country=US&sort_by=popularity.desc', 'tv')
    } else if (activeTab === 'anime') {
      fetchSection('trending_anime', '今注目のアニメ', '/api/tmdb?action=discover&type=tv&with_genres=16&sort_by=popularity.desc', 'tv')
      fetchSection('airing_anime', '放送中', '/api/tmdb?action=on_the_air', 'tv')
    }
  }, [activeTab, debouncedQuery, browse.mode, fetchSection])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setDebouncedQuery('')
      setSearchResults([])
      setSearchPage(1)
      setSearchTotalPages(1)
      return
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Execute search when debouncedQuery changes
  useEffect(() => {
    if (!debouncedQuery) return
    setSearchLoading(true)
    setSearchResults([])
    setSearchPage(1)
    fetch(`/api/tmdb?action=search&query=${encodeURIComponent(debouncedQuery)}&page=1`)
      .then(r => r.json())
      .then(data => {
        setSearchResults(data.results || [])
        setSearchTotalPages(data.total_pages || 1)
      })
      .catch(() => {})
      .finally(() => setSearchLoading(false))
  }, [debouncedQuery])

  const loadMoreSearch = async () => {
    const nextPage = searchPage + 1
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/tmdb?action=search&query=${encodeURIComponent(debouncedQuery)}&page=${nextPage}`)
      const data = await res.json()
      setSearchResults(prev => [...prev, ...(data.results || [])])
      setSearchPage(nextPage)
      setSearchTotalPages(data.total_pages || 1)
    } catch { /* ignore */ }
    setSearchLoading(false)
  }

  // --- Genre / Year browsing ---
  const browseGenre = async (genreId: number, genreName: string, page: number = 1) => {
    const mediaType = activeTab === 'movie' ? 'movie' : 'tv'
    const extraGenre = activeTab === 'anime' ? `16,${genreId}` : String(genreId)
    setBrowse({ mode: 'genre', label: genreName, items: page === 1 ? [] : browse.items, loading: true, page, totalPages: 1 })
    try {
      const res = await fetch(`/api/tmdb?action=discover&type=${mediaType}&with_genres=${extraGenre}&page=${page}&sort_by=popularity.desc`)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || mediaType,
      }))
      setBrowse(prev => ({
        ...prev,
        items: page === 1 ? items : [...prev.items, ...items],
        loading: false,
        page,
        totalPages: data.total_pages || 1,
      }))
    } catch {
      setBrowse(prev => ({ ...prev, loading: false }))
    }
  }

  const browseDecade = async (gte: string, lte: string, label: string, page: number = 1) => {
    setBrowse({ mode: 'year', label, items: page === 1 ? [] : browse.items, loading: true, page, totalPages: 1 })
    try {
      const res = await fetch(`/api/tmdb?action=discover&type=movie&primary_release_date.gte=${gte}&primary_release_date.lte=${lte}&page=${page}&sort_by=popularity.desc`)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || 'movie',
      }))
      setBrowse(prev => ({
        ...prev,
        items: page === 1 ? items : [...prev.items, ...items],
        loading: false,
        page,
        totalPages: data.total_pages || 1,
      }))
    } catch {
      setBrowse(prev => ({ ...prev, loading: false }))
    }
  }

  const goBackToHome = () => {
    setBrowse({ mode: 'home', label: '', items: [], loading: false, page: 1, totalPages: 1 })
  }

  // --- Filter anime airing results ---
  const filterAnimeItems = (items: TMDBItem[]): TMDBItem[] => {
    if (activeTab !== 'anime') return items
    return items.filter(item => item.genre_ids?.includes(16))
  }

  // --- Render helpers ---
  const renderPosterCard = (item: TMDBItem, inGrid: boolean = false) => {
    const type = getType(item)
    const score = item.vote_average > 0 ? formatScore(item.vote_average) : null
    const style = inGrid ? S.gridCard : S.posterCard

    return (
      <div
        key={`${item.media_type || 'item'}-${item.id}`}
        style={style}
        onClick={() => onOpenWork(item.id, type)}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(108,92,231,0.3)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
        }}
      >
        <div style={{ position: 'relative', aspectRatio: '2/3' }}>
          {item.poster_path ? (
            <img
              src={`${TMDB_IMG}/w342${item.poster_path}`}
              alt={getTitle(item)}
              style={S.posterImg}
              loading="lazy"
            />
          ) : (
            <div style={S.noImg}>🎬</div>
          )}
          <span style={S.badge(type)}>
            {type === 'movie' ? '映画' : 'TV'}
          </span>
          {score && (
            <span style={S.score}>★{score}</span>
          )}
        </div>
        <div style={{ padding: '8px 8px 10px' }}>
          <div style={S.cardTitle}>{getTitle(item)}</div>
          <div style={S.cardSub}>{getYear(item)}</div>
        </div>
      </div>
    )
  }

  const renderSkeletonRow = () => (
    <div style={{ ...S.scrollRow, overflowX: 'hidden' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 130 }}>
          <div style={S.skeleton} />
          <div style={{ height: 12, width: '70%', background: '#1e1f36', borderRadius: 4, marginTop: 8 }} />
        </div>
      ))}
    </div>
  )

  const renderSkeletonGrid = () => (
    <div style={S.grid}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={S.skeleton} />
      ))}
    </div>
  )

  const renderScrollSection = (key: string) => {
    const section = sections[key]
    if (!section) return null

    return (
      <div key={key}>
        <div style={S.sectionHeader}>{section.title}</div>
        {section.loading ? renderSkeletonRow() : (
          <div style={S.scrollRow}>
            {(activeTab === 'anime' && key === 'airing_anime' ? filterAnimeItems(section.items) : section.items)
              .slice(0, 20)
              .map(item => renderPosterCard(item))}
          </div>
        )}
      </div>
    )
  }

  const renderGenreChips = () => {
    const genres = activeTab === 'movie' ? MOVIE_GENRES
      : activeTab === 'drama' ? TV_GENRES
      : ANIME_GENRES

    return (
      <div>
        <div style={S.sectionHeader}>ジャンルで探す</div>
        <div style={S.genreGrid}>
          {genres.map(g => (
            <button
              key={g.id}
              style={S.genrePill(false)}
              onClick={() => browseGenre(g.id, `${g.emoji} ${g.name}`)}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#6c5ce7'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.15)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2b46'
                ;(e.currentTarget as HTMLButtonElement).style.background = '#12132a'
              }}
            >
              {g.emoji} {g.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderDecadeButtons = () => (
    <div>
      <div style={S.sectionHeader}>製作年で探す</div>
      <div style={S.decadeGrid}>
        {DECADES.map(d => (
          <button
            key={d.label}
            style={S.decadePill}
            onClick={() => browseDecade(d.gte, d.lte, d.label)}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#6c5ce7'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.15)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2b46'
              ;(e.currentTarget as HTMLButtonElement).style.background = '#12132a'
            }}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  )

  // --- Search results view ---
  const renderSearchView = () => {
    const filtered = searchResults.filter(r => {
      if (!r.poster_path) return false
      if (activeTab === 'movie') return r.media_type === 'movie'
      if (activeTab === 'drama') return r.media_type === 'tv'
      if (activeTab === 'anime') return r.media_type === 'tv' || r.genre_ids?.includes(16)
      return true
    })

    return (
      <div>
        {searchLoading && searchResults.length === 0 ? renderSkeletonGrid() : (
          <>
            <div style={S.grid}>
              {filtered.map(item => renderPosterCard(item, true))}
            </div>
            {filtered.length === 0 && !searchLoading && (
              <div style={S.emptyState}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 15 }}>「{debouncedQuery}」に一致する結果がありません</div>
              </div>
            )}
            {searchPage < searchTotalPages && filtered.length > 0 && (
              <button
                style={S.loadMoreBtn}
                onClick={loadMoreSearch}
                disabled={searchLoading}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.2)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                {searchLoading ? '読み込み中...' : 'もっと見る'}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  // --- Browse results (genre/year drill-down) ---
  const renderBrowseView = () => (
    <div>
      <button style={S.backBtn} onClick={goBackToHome}>
        ← 戻る
      </button>
      <div style={{ ...S.sectionHeader, fontSize: 18 }}>{browse.label}</div>
      {browse.loading && browse.items.length === 0 ? renderSkeletonGrid() : (
        <>
          <div style={S.grid}>
            {browse.items.map(item => renderPosterCard(item, true))}
          </div>
          {browse.page < browse.totalPages && browse.items.length > 0 && (
            <button
              style={S.loadMoreBtn}
              onClick={() => {
                if (browse.mode === 'genre') {
                  // Re-derive genre ID from the items' context
                  const genres = activeTab === 'movie' ? MOVIE_GENRES
                    : activeTab === 'drama' ? TV_GENRES : ANIME_GENRES
                  const found = genres.find(g => browse.label.includes(g.name))
                  if (found) browseGenre(found.id, browse.label, browse.page + 1)
                } else if (browse.mode === 'year') {
                  const decade = DECADES.find(d => d.label === browse.label)
                  if (decade) browseDecade(decade.gte, decade.lte, browse.label, browse.page + 1)
                }
              }}
              disabled={browse.loading}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.2)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              {browse.loading ? '読み込み中...' : 'もっと見る'}
            </button>
          )}
        </>
      )}
    </div>
  )

  // --- Home browsing (sections) ---
  const renderHomeView = () => {
    if (activeTab === 'movie') {
      return (
        <>
          {renderScrollSection('trending_movie')}
          {renderScrollSection('now_playing')}
          {renderScrollSection('upcoming')}
          {renderGenreChips()}
          {renderDecadeButtons()}
        </>
      )
    }
    if (activeTab === 'drama') {
      return (
        <>
          {renderScrollSection('trending_tv')}
          {renderScrollSection('jp_drama')}
          {renderScrollSection('kr_drama')}
          {renderScrollSection('us_drama')}
          {renderGenreChips()}
        </>
      )
    }
    if (activeTab === 'anime') {
      return (
        <>
          {renderScrollSection('trending_anime')}
          {renderScrollSection('airing_anime')}
          {renderGenreChips()}
        </>
      )
    }
    return null
  }

  const isSearching = !!debouncedQuery
  const isBrowsing = browse.mode !== 'home'

  return (
    <div style={S.page}>
      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Category tabs */}
      <div style={S.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            style={S.tab(activeTab === tab.key)}
            onClick={() => {
              setActiveTab(tab.key)
              goBackToHome()
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div style={S.searchWrap}>
        <div style={{ position: 'relative' }}>
          <span style={S.searchIcon}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="作品名・キャスト・キーワードで検索"
            style={S.searchInput}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#6c5ce7'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,92,231,0.2)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#2a2b46'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          {query && (
            <button
              style={S.clearBtn}
              onClick={() => { setQuery(''); setSearchResults([]); setDebouncedQuery('') }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isSearching
        ? renderSearchView()
        : isBrowsing
          ? renderBrowseView()
          : renderHomeView()
      }
    </div>
  )
}
