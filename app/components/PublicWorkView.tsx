/**
 * Public, server-rendered work detail page used by /movies/[id] and /tv/[id].
 *
 * Purpose: crawlable HTML with structured data (Movie / TVSeries) so individual
 * works can rank in search engines. The in-app modal (WorkDetail.tsx) keeps the
 * authenticated UX; this is the public shell.
 */
import Link from 'next/link'
import { getMovieDetailCached, getUserWorkDetail } from '@/app/lib/tmdb-cache'
import AuthGate from './AuthGate'

const TMDB_IMG = 'https://image.tmdb.org/t/p'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://filmo.me'

interface CrewMember { id: number; name: string; job: string; department: string; profile_path?: string | null }
interface CastMember { id: number; name: string; character: string; profile_path: string | null; order: number }
interface Genre { id: number; name: string }
interface ProductionCountry { iso_3166_1: string; name: string }

export interface PublicWorkData {
  id: number
  title: string
  original_title: string | null
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string | null
  /** ユーザー登録で「年のみ」入力された作品では release_date が YYYY-01-01 になる。
   *  この場合は表示で日付までは見せず年だけ出すためのフラグ。 */
  release_year_only: boolean
  homepage: string | null
  runtime: number | null
  vote_average: number
  vote_count: number
  genres: Genre[]
  cast: CastMember[]
  director: CrewMember | null
  writers: CrewMember[]
  production_countries: ProductionCountry[]
  type: 'movie' | 'tv'
  source: 'tmdb' | 'user'
}

/**
 * Fetches a public work for SSR. Returns null if not found / not eligible.
 * Negative IDs are treated as user-registered works (Annict / user-submitted).
 */
export async function fetchPublicWork(rawId: string, type: 'movie' | 'tv'): Promise<PublicWorkData | null> {
  const id = Number(rawId)
  if (!Number.isFinite(id) || id === 0) return null

  try {
    if (id < 0) {
      // user-registered work (negative id sentinel)
      const data = await getUserWorkDetail(id)
      if (!data) return null
      return normalizeUserWork(data, type)
    }

    const data = await getMovieDetailCached(id, type)
    if (!data) return null
    return normalizeTmdbWork(data, type)
  } catch {
    return null
  }
}

interface UserWorkRow {
  id: number
  title?: string | null
  original_title?: string | null
  overview?: string | null
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string | null
  release_year_only?: boolean | null
  homepage?: string | null
  runtime?: number | null
  vote_average?: number | null
  vote_count?: number | null
  genres?: Genre[] | null
  production_countries?: ProductionCountry[] | null
  credits?: { cast?: CastMember[]; crew?: CrewMember[] } | null
}

function normalizeUserWork(row: UserWorkRow, type: 'movie' | 'tv'): PublicWorkData | null {
  if (!row.title) return null
  const crew = row.credits?.crew || []
  const director = crew.find(c => c.job === 'Director') || null
  const writers = crew.filter(c => c.department === 'Writing' || c.job === 'Screenplay' || c.job === 'Writer')
  return {
    id: row.id,
    title: row.title,
    original_title: row.original_title || null,
    overview: row.overview || '',
    poster_path: row.poster_path || null,
    backdrop_path: row.backdrop_path || null,
    release_date: row.release_date || null,
    release_year_only: !!row.release_year_only,
    homepage: row.homepage || null,
    runtime: row.runtime || null,
    vote_average: row.vote_average || 0,
    vote_count: row.vote_count || 0,
    genres: row.genres || [],
    cast: (row.credits?.cast || []).slice(0, 12),
    director,
    writers: writers.slice(0, 3),
    production_countries: row.production_countries || [],
    type,
    source: 'user',
  }
}

interface TmdbDetail {
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  homepage?: string | null
  runtime?: number
  episode_run_time?: number[]
  vote_average?: number
  vote_count?: number
  genres?: Genre[]
  production_countries?: ProductionCountry[]
  credits?: { cast?: CastMember[]; crew?: CrewMember[] }
}

function normalizeTmdbWork(data: TmdbDetail, type: 'movie' | 'tv'): PublicWorkData | null {
  const title = data.title || data.name
  if (!title) return null
  const crew = data.credits?.crew || []
  const director = crew.find(c => c.job === 'Director')
    || crew.find(c => c.department === 'Directing' && c.job === 'Series Director')
    || null
  const writers = crew.filter(c => c.department === 'Writing' || c.job === 'Screenplay' || c.job === 'Writer')
  return {
    id: data.id,
    title,
    original_title: data.original_title || data.original_name || null,
    overview: data.overview || '',
    poster_path: data.poster_path || null,
    backdrop_path: data.backdrop_path || null,
    release_date: data.release_date || data.first_air_date || null,
    release_year_only: false,
    homepage: data.homepage || null,
    runtime: data.runtime || data.episode_run_time?.[0] || null,
    vote_average: data.vote_average || 0,
    vote_count: data.vote_count || 0,
    genres: data.genres || [],
    cast: (data.credits?.cast || []).slice(0, 12),
    director,
    writers: writers.slice(0, 3),
    production_countries: data.production_countries || [],
    type,
    source: 'tmdb',
  }
}

// ── Metadata helpers ────────────────────────────────────────────────────────

export function buildWorkTitle(w: PublicWorkData): string {
  const year = w.release_date ? w.release_date.slice(0, 4) : null
  const typeLabel = w.type === 'movie' ? '映画' : 'ドラマ・TV'
  return year ? `『${w.title}』(${year}) ${typeLabel}` : `『${w.title}』 ${typeLabel}`
}

export function buildWorkDescription(w: PublicWorkData): string {
  const parts: string[] = []
  if (w.director) parts.push(`監督: ${w.director.name}`)
  if (w.cast.length > 0) parts.push(`出演: ${w.cast.slice(0, 3).map(c => c.name).join('・')}`)
  if (w.genres.length > 0) parts.push(`ジャンル: ${w.genres.map(g => g.name).join('・')}`)
  const head = parts.join(' / ')
  const tail = w.overview ? ` ${w.overview}` : ''
  const desc = `${head}${tail}`.trim()
  // メタディスクリプションは155字程度が無難
  return desc.length > 155 ? `${desc.slice(0, 152)}…` : desc
}

export function buildWorkUrl(w: PublicWorkData): string {
  const path = w.type === 'movie' ? 'movies' : 'tv'
  return `${APP_URL}/${path}/${w.id}`
}

export function buildPosterUrl(posterPath: string | null, size: 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
  if (!posterPath) return null
  if (posterPath.startsWith('http')) return posterPath
  return `${TMDB_IMG}/${size}${posterPath}`
}

// ── JSON-LD (Movie / TVSeries schema) ───────────────────────────────────────

export function buildWorkJsonLd(w: PublicWorkData): Record<string, unknown> {
  const schemaType = w.type === 'movie' ? 'Movie' : 'TVSeries'
  const url = buildWorkUrl(w)
  const image = buildPosterUrl(w.poster_path, 'w780')

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: w.title,
    url,
  }
  if (w.original_title && w.original_title !== w.title) jsonLd.alternateName = w.original_title
  if (image) jsonLd.image = image
  if (w.overview) jsonLd.description = w.overview
  // 「年のみ」のユーザー登録作品は schema.org でも年だけ出す
  if (w.release_date) {
    jsonLd.datePublished = w.release_year_only ? w.release_date.slice(0, 4) : w.release_date
  }
  if (w.runtime && w.type === 'movie') jsonLd.duration = `PT${w.runtime}M`
  if (w.genres.length > 0) jsonLd.genre = w.genres.map(g => g.name)
  if (w.production_countries.length > 0) {
    jsonLd.countryOfOrigin = w.production_countries.map(c => ({ '@type': 'Country', name: c.name }))
  }
  if (w.director) {
    jsonLd.director = { '@type': 'Person', name: w.director.name }
  }
  if (w.writers.length > 0) {
    jsonLd.author = w.writers.map(p => ({ '@type': 'Person', name: p.name }))
  }
  if (w.cast.length > 0) {
    jsonLd.actor = w.cast.slice(0, 8).map(c => ({ '@type': 'Person', name: c.name }))
  }
  if (w.vote_average > 0 && w.vote_count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: w.vote_average.toFixed(1),
      bestRating: 10,
      worstRating: 0,
      ratingCount: w.vote_count,
    }
  }
  return jsonLd
}

// ── View ────────────────────────────────────────────────────────────────────

export function PublicWorkView({ work }: { work: PublicWorkData }) {
  const poster = buildPosterUrl(work.poster_path, 'w500')
  const backdrop = work.backdrop_path ? buildPosterUrl(work.backdrop_path, 'w780') : null
  const year = work.release_date?.slice(0, 4)
  const score = work.vote_average > 0 ? (work.vote_average / 2).toFixed(1) : null

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', color: 'var(--fm-text)' }}>
      <header style={{
        borderBottom: '1px solid var(--fm-border)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1.5, color: 'var(--fm-text)', textTransform: 'uppercase' }}>
            Filmo
          </span>
        </Link>
        <AuthGate hideWhenAuthed>
          <Link href="/" style={{
            padding: '6px 16px', borderRadius: 6,
            background: 'var(--fm-accent)', color: '#fff', fontSize: 12, fontWeight: 600,
            textDecoration: 'none',
          }}>
            無料で記録を始める
          </Link>
        </AuthGate>
      </header>

      {backdrop && (
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          maxHeight: 360,
          overflow: 'hidden',
          background: '#0a0a0f',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backdrop} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: 0.35,
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(8,9,13,0) 0%, var(--fm-bg) 100%)',
          }} />
        </div>
      )}

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 20, marginBottom: 24 }}>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={work.title}
              style={{ width: 160, height: 240, objectFit: 'cover', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
            />
          ) : (
            <div style={{ width: 160, height: 240, borderRadius: 8, background: 'var(--fm-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
              🎬
            </div>
          )}

          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.3 }}>
              {work.title}
            </h1>
            {work.original_title && work.original_title !== work.title && (
              <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 8 }}>
                {work.original_title}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 12 }}>
              {year && <span>{year}</span>}
              {work.runtime ? <span>{work.runtime}分</span> : null}
              {score && <span style={{ color: 'var(--fm-star)' }}>★ {score}</span>}
              <span>{work.type === 'movie' ? '映画' : 'ドラマ・TV'}</span>
            </div>
            {work.genres.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {work.genres.map(g => (
                  <span key={g.id} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 10,
                    background: 'var(--fm-bg-card)', color: 'var(--fm-text-sub)',
                    border: '1px solid var(--fm-border)',
                  }}>{g.name}</span>
                ))}
              </div>
            )}
            {work.director && (
              <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 4 }}>
                監督: <Link href={`/people/${work.director.id}`} style={{ color: 'var(--fm-text)', textDecoration: 'none' }}>
                  {work.director.name}
                </Link>
              </div>
            )}
            {work.writers.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>
                脚本: {work.writers.map((w, i) => (
                  <span key={w.id}>
                    {i > 0 ? '、' : ''}
                    <Link href={`/people/${w.id}`} style={{ color: 'var(--fm-text)', textDecoration: 'none' }}>
                      {w.name}
                    </Link>
                  </span>
                ))}
              </div>
            )}
            {work.homepage && (
              <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginTop: 4 }}>
                公式サイト:{' '}
                <a
                  href={work.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--fm-accent)', textDecoration: 'underline', wordBreak: 'break-all' }}
                >
                  {work.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </div>
            )}
          </div>
        </div>

        {work.overview && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--fm-text)' }}>あらすじ</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--fm-text-sub)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {work.overview}
            </p>
          </section>
        )}

        {work.cast.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>キャスト</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
              {work.cast.slice(0, 8).map(c => (
                <Link
                  key={c.id}
                  href={`/people/${c.id}`}
                  style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }}
                >
                  {c.profile_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${TMDB_IMG}/w185${c.profile_path}`} alt={c.name}
                      style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '2/3', background: 'var(--fm-bg-secondary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: 'var(--fm-text)' }}>{c.name}</div>
                  {c.character && (
                    <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 2 }}>{c.character}</div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        <AuthGate hideWhenAuthed>
          <section style={{
            marginTop: 32, padding: 24, borderRadius: 12,
            background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
            textAlign: 'center',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>
              『{work.title}』を Filmo で記録しよう
            </h3>
            <p style={{ fontSize: 13, color: 'var(--fm-text-sub)', margin: '0 0 16px' }}>
              星評価・レビュー・配信情報をまとめて管理。完全無料。
            </p>
            <Link href="/" style={{
              display: 'inline-block', padding: '10px 28px', borderRadius: 8,
              background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
            }}>
              無料で始める
            </Link>
          </section>
        </AuthGate>
      </div>
    </div>
  )
}
