'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

interface PersonResult {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string | null
  known_for: { title?: string; name?: string }[]
}

interface PersonSearchProps {
  placeholder?: string
  filterDepartment?: 'Directing' | 'Writing'
}

export default function PersonSearch({ placeholder, filterDepartment }: PersonSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PersonResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/tmdb?action=search_person&query=${encodeURIComponent(query)}`)
        const data = await res.json()
        let list = (data.results || []) as PersonResult[]
        if (filterDepartment) {
          list = list.filter(p => p.known_for_department === filterDepartment)
        }
        setResults(list.slice(0, 20))
      } catch (e) {
        console.error('person search failed:', e)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, filterDepartment])

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder || '人物名で検索'}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 8,
          border: '1px solid var(--fm-border)', background: 'var(--fm-bg-card)',
          color: 'var(--fm-text)', fontSize: 14, outline: 'none',
        }}
      />

      {loading && (
        <div style={{ fontSize: 12, color: 'var(--fm-text-muted)', padding: 8 }}>検索中…</div>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--fm-text-muted)', padding: 12 }}>
          該当する人物が見つかりません
        </div>
      )}

      {results.length > 0 && (
        <div style={{
          marginTop: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
        }}>
          {results.map(p => (
            <Link key={p.id} href={`/?person=${p.id}`} style={{
              textDecoration: 'none', color: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: 10, borderRadius: 10,
              background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
            }}>
              {p.profile_path ? (
                <img src={`${TMDB_IMG}/w185${p.profile_path}`} alt={p.name}
                  loading="lazy"
                  style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'var(--fm-bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, color: 'var(--fm-text-muted)',
                }}>
                  {p.name.charAt(0)}
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                {p.name}
              </div>
              {p.known_for_department && (
                <div style={{ fontSize: 10, color: 'var(--fm-text-muted)' }}>
                  {p.known_for_department}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
