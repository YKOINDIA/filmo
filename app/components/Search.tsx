'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

const GENRE_LIST = [
  { id: 28, name: 'アクション' }, { id: 12, name: 'アドベンチャー' },
  { id: 16, name: 'アニメ' }, { id: 35, name: 'コメディ' },
  { id: 80, name: '犯罪' }, { id: 99, name: 'ドキュメンタリー' },
  { id: 18, name: 'ドラマ' }, { id: 10751, name: 'ファミリー' },
  { id: 14, name: 'ファンタジー' }, { id: 36, name: '歴史' },
  { id: 27, name: 'ホラー' }, { id: 10402, name: '音楽' },
  { id: 9648, name: 'ミステリー' }, { id: 10749, name: 'ロマンス' },
  { id: 878, name: 'SF' }, { id: 53, name: 'スリラー' },
  { id: 10752, name: '戦争' }, { id: 37, name: '西部劇' },
]

interface SearchResult {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  media_type: string
  release_date?: string
  first_air_date?: string
  vote_average: number
  overview: string
  genre_ids: number[]
}

export default function Search({ userId, onOpenWork }: {
  userId: string
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [trending, setTrending] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'anime'>('all')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedGenres, setSelectedGenres] = useState<number[]>([])
  const [yearFrom, setYearFrom] = useState('')
  const [yearTo, setYearTo] = useState('')
  const [sortBy, setSortBy] = useState('popularity.desc')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    fetch('/api/tmdb?action=trending')
      .then(r => r.json())
      .then(d => setTrending(d.results || []))
      .catch(() => {})
  }, [])

  const doSearch = useCallback(async (q: string, p: number = 1) => {
    if (!q.trim() && selectedGenres.length === 0) return
    setLoading(true)
    try {
      let url: string
      if (q.trim()) {
        url = `/api/tmdb?action=search&query=${encodeURIComponent(q)}&page=${p}`
      } else {
        const type = filter === 'anime' ? 'tv' : filter === 'all' ? 'movie' : filter
        const params = new URLSearchParams({ action: 'discover', type, page: String(p), sort_by: sortBy })
        if (selectedGenres.length) params.set('with_genres', selectedGenres.join(','))
        if (yearFrom) params.set('primary_release_date.gte', `${yearFrom}-01-01`)
        if (yearTo) params.set('primary_release_date.lte', `${yearTo}-12-31`)
        if (filter === 'anime') params.set('with_genres', '16')
        url = `/api/tmdb?${params.toString()}`
      }
      const res = await fetch(url)
      const data = await res.json()
      const items = data.results || []
      if (p === 1) setResults(items)
      else setResults(prev => [...prev, ...items])
      setTotalPages(data.total_pages || 1)
      setPage(p)
    } catch { /* ignore */ }
    setLoading(false)
  }, [filter, selectedGenres, yearFrom, yearTo, sortBy])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(() => doSearch(query, 1), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const filteredResults = (results.length > 0 ? results : []).filter(r => {
    if (filter === 'all') return true
    if (filter === 'movie') return r.media_type === 'movie'
    if (filter === 'tv') return r.media_type === 'tv'
    if (filter === 'anime') return r.genre_ids?.includes(16)
    return true
  })

  const displayItems = query.trim() || selectedGenres.length > 0 ? filteredResults : trending

  const toggleGenre = (id: number) => {
    setSelectedGenres(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  const getTitle = (r: SearchResult) => r.title || r.name || ''
  const getYear = (r: SearchResult) => (r.release_date || r.first_air_date || '').substring(0, 4)
  const getType = (r: SearchResult): 'movie' | 'tv' => r.media_type === 'movie' ? 'movie' : 'tv'

  return (
    <div style={{ padding: '16px' }}>
      {/* 検索バー */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="映画・ドラマ・アニメを検索..."
          style={{
            width: '100%', padding: '14px 16px 14px 42px', borderRadius: 12,
            border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
            color: 'var(--fm-text)', fontSize: 15, boxSizing: 'border-box',
          }}
        />
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔍</span>
        {query && (
          <button onClick={() => { setQuery(''); setResults([]) }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--fm-text-sub)', cursor: 'pointer', fontSize: 18 }}>
            ×
          </button>
        )}
      </div>

      {/* フィルタータブ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
        {([['all', '全て'], ['movie', '映画'], ['tv', 'ドラマ'], ['anime', 'アニメ']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)}
            style={{
              padding: '8px 16px', borderRadius: 20, border: '1px solid var(--fm-border)',
              background: filter === key ? 'var(--fm-accent)' : 'var(--fm-bg-card)',
              color: filter === key ? '#fff' : 'var(--fm-text-sub)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {label}
          </button>
        ))}
        <button onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            padding: '8px 16px', borderRadius: 20, border: '1px solid var(--fm-border)',
            background: showAdvanced ? 'var(--fm-accent-dark)' : 'var(--fm-bg-card)',
            color: showAdvanced ? '#fff' : 'var(--fm-text-sub)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          🎛️ 詳細
        </button>
      </div>

      {/* 詳細フィルター */}
      {showAdvanced && (
        <div className="animate-fade-in" style={{
          background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16,
          border: '1px solid var(--fm-border)', marginBottom: 16,
        }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 8 }}>ジャンル</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {GENRE_LIST.map(g => (
                <button key={g.id} onClick={() => toggleGenre(g.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 14, border: '1px solid var(--fm-border)',
                    background: selectedGenres.includes(g.id) ? 'var(--fm-accent)' : 'transparent',
                    color: selectedGenres.includes(g.id) ? '#fff' : 'var(--fm-text-sub)',
                    fontSize: 12, cursor: 'pointer',
                  }}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 4 }}>公開年（から）</div>
              <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)} placeholder="1980"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 4 }}>公開年（まで）</div>
              <input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)} placeholder="2026"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 4 }}>並び替え</div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14 }}>
              <option value="popularity.desc">人気順</option>
              <option value="vote_average.desc">評価順</option>
              <option value="release_date.desc">公開日（新しい）</option>
              <option value="release_date.asc">公開日（古い）</option>
            </select>
          </div>

          <button onClick={() => doSearch('', 1)}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--fm-accent)', color: '#fff', fontWeight: 600, fontSize: 14,
            }}>
            検索する
          </button>
        </div>
      )}

      {/* セクションタイトル */}
      {!query.trim() && selectedGenres.length === 0 && (
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>🔥 トレンド</div>
      )}

      {/* 結果 */}
      {loading && results.length === 0 ? (
        <div className="poster-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: '2/3', background: 'var(--fm-bg-card)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <>
          <div className="poster-grid">
            {displayItems.map(item => (
              <div key={`${item.media_type}-${item.id}`}
                className="card-hover"
                onClick={() => onOpenWork(item.id, getType(item))}
                style={{ cursor: 'pointer', borderRadius: 10, overflow: 'hidden', background: 'var(--fm-bg-card)' }}>
                <div style={{ position: 'relative', aspectRatio: '2/3' }}>
                  {item.poster_path ? (
                    <img src={`${TMDB_IMG}/w342${item.poster_path}`} alt={getTitle(item)}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'var(--fm-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎬</div>
                  )}
                  {/* メディアタイプバッジ */}
                  <span style={{
                    position: 'absolute', top: 6, left: 6, padding: '2px 6px', borderRadius: 4,
                    background: item.media_type === 'movie' ? 'rgba(108,92,231,0.9)' : 'rgba(46,204,138,0.9)',
                    color: '#fff', fontSize: 10, fontWeight: 700,
                  }}>
                    {item.media_type === 'movie' ? '映画' : 'TV'}
                  </span>
                  {/* 評価 */}
                  {item.vote_average > 0 && (
                    <span style={{
                      position: 'absolute', top: 6, right: 6, padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(0,0,0,0.7)', color: item.vote_average >= 7 ? '#2ecc8a' : item.vote_average >= 5 ? '#f0c040' : '#ff6b6b',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      ★{item.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>
                <div style={{ padding: '8px 6px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getTitle(item)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>{getYear(item)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* もっと読み込む */}
          {page < totalPages && results.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button onClick={() => doSearch(query, page + 1)} disabled={loading}
                style={{
                  padding: '12px 32px', borderRadius: 12, border: '1px solid var(--fm-border)',
                  background: 'var(--fm-bg-card)', color: 'var(--fm-text)', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                }}>
                {loading ? '読み込み中...' : 'もっと見る'}
              </button>
            </div>
          )}

          {displayItems.length === 0 && !loading && query.trim() && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fm-text-sub)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <div>「{query}」に一致する結果がありません</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
