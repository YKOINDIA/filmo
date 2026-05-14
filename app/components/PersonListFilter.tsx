'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// よく登場する制作国 (TMDB の production_countries.iso_3166_1)
// Filmo 利用者の関心が高い順に並べている
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'JP', name: '🇯🇵 日本' },
  { code: 'US', name: '🇺🇸 アメリカ' },
  { code: 'KR', name: '🇰🇷 韓国' },
  { code: 'CN', name: '🇨🇳 中国' },
  { code: 'HK', name: '🇭🇰 香港' },
  { code: 'TW', name: '🇹🇼 台湾' },
  { code: 'TH', name: '🇹🇭 タイ' },
  { code: 'IN', name: '🇮🇳 インド' },
  { code: 'GB', name: '🇬🇧 イギリス' },
  { code: 'FR', name: '🇫🇷 フランス' },
  { code: 'DE', name: '🇩🇪 ドイツ' },
  { code: 'IT', name: '🇮🇹 イタリア' },
  { code: 'ES', name: '🇪🇸 スペイン' },
  { code: 'RU', name: '🇷🇺 ロシア' },
  { code: 'CA', name: '🇨🇦 カナダ' },
  { code: 'AU', name: '🇦🇺 オーストラリア' },
  { code: 'BR', name: '🇧🇷 ブラジル' },
  { code: 'MX', name: '🇲🇽 メキシコ' },
]

interface Props {
  initialCountry?: string
  initialMovie?: string
  /** 入力プレースホルダー (例: 「黒澤明 出演作」) */
  moviePlaceholder?: string
}

export default function PersonListFilter({ initialCountry = '', initialMovie = '', moviePlaceholder }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [country, setCountry] = useState(initialCountry)
  const [movie, setMovie] = useState(initialMovie)
  const [isPending, startTransition] = useTransition()

  const apply = (nextCountry: string, nextMovie: string) => {
    const params = new URLSearchParams()
    if (nextCountry) params.set('country', nextCountry)
    if (nextMovie.trim()) params.set('movie', nextMovie.trim())
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  const reset = () => {
    setCountry('')
    setMovie('')
    startTransition(() => router.push(pathname))
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    apply(country, movie)
  }

  const hasFilter = !!country || !!movie.trim()

  return (
    <form
      onSubmit={onSubmit}
      style={{
        margin: '14px 0 0',
        padding: 12,
        background: 'var(--fm-bg-card)',
        border: '1px solid var(--fm-border)',
        borderRadius: 10,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <select
        value={country}
        onChange={e => {
          setCountry(e.target.value)
          apply(e.target.value, movie)
        }}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--fm-border)',
          background: 'var(--fm-bg-secondary)',
          color: 'var(--fm-text)',
          fontSize: 13,
          minWidth: 140,
        }}
      >
        <option value="">🌍 国で絞り込み</option>
        {COUNTRIES.map(c => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>

      <input
        type="text"
        value={movie}
        onChange={e => setMovie(e.target.value)}
        placeholder={moviePlaceholder || '🎬 映画タイトルで絞り込み'}
        style={{
          flex: '1 1 200px',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--fm-border)',
          background: 'var(--fm-bg-secondary)',
          color: 'var(--fm-text)',
          fontSize: 13,
          minWidth: 140,
        }}
      />

      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: '8px 16px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--fm-accent)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? '検索中…' : '絞り込む'}
      </button>

      {hasFilter && (
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--fm-border)',
            background: 'transparent',
            color: 'var(--fm-text-muted)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          クリア
        </button>
      )}
    </form>
  )
}
