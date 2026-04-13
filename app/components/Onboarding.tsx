'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { MIN_RATINGS_FOR_MATCH } from '../lib/matchScore'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342'
const TMDB_IMG_PROFILE = 'https://image.tmdb.org/t/p/w185'
const RECOMMENDED_RATINGS = 10

interface OnboardingProps {
  userId: string
  onComplete: () => void
}

interface MovieItem {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  media_type?: string
  vote_average?: number
  genre_ids?: number[]
  release_date?: string
  first_air_date?: string
}

interface PersonItem {
  id: number
  name: string
  profile_path: string | null
  known_for_department?: string
  known_for?: { title?: string; name?: string }[]
}

// page: 0=intro, 1=rate movies, 2=fan selection
type OnboardingPage = 0 | 1 | 2

export default function Onboarding({ userId, onComplete }: OnboardingProps) {
  const [movies, setMovies] = useState<MovieItem[]>([])
  const [people, setPeople] = useState<PersonItem[]>([])
  const [loadingMovies, setLoadingMovies] = useState(true)
  const [loadingPeople, setLoadingPeople] = useState(true)
  const [ratings, setRatings] = useState<Record<number, number>>({})
  const [fanSelections, setFanSelections] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState<OnboardingPage>(0)
  const [personSearch, setPersonSearch] = useState('')
  const [searchResults, setSearchResults] = useState<PersonItem[]>([])
  const [searching, setSearching] = useState(false)

  const ratedCount = Object.keys(ratings).length
  const canProceed = ratedCount >= MIN_RATINGS_FOR_MATCH

  // ── Fetch popular movies ──
  const fetchPopularMovies = useCallback(async () => {
    try {
      const [trendingRes, topRatedRes] = await Promise.all([
        fetch('/api/tmdb?action=trending'),
        fetch('/api/tmdb?action=discover&type=movie&sort_by=vote_count.desc'),
      ])

      const trending = trendingRes.ok ? await trendingRes.json() : { results: [] }
      const topRated = topRatedRes.ok ? await topRatedRes.json() : { results: [] }

      const seen = new Set<number>()
      const all: MovieItem[] = []
      for (const item of [...(trending.results || []), ...(topRated.results || [])]) {
        if (seen.has(item.id) || item.media_type === 'person') continue
        seen.add(item.id)
        all.push(item)
      }
      setMovies(all.slice(0, 30))
    } catch (err) {
      console.error('Onboarding movie fetch error:', err)
    } finally {
      setLoadingMovies(false)
    }
  }, [])

  // ── Fetch popular people (directors & actors) ──
  const fetchPopularPeople = useCallback(async () => {
    try {
      const res = await fetch('/api/tmdb?action=search&query=popular&type=person')
      // Use trending for popular people instead
      const trendRes = await fetch(
        `/api/tmdb?action=trending_people`
      )
      let results: PersonItem[] = []
      if (trendRes.ok) {
        const data = await trendRes.json()
        results = data.results || []
      }
      // Fallback: search well-known directors
      if (results.length === 0) {
        const names = ['Spielberg', 'Nolan', 'Miyazaki', 'Tarantino', 'Scorsese', 'Villeneuve', 'Bong', 'Hirokazu']
        for (const name of names) {
          try {
            const r = await fetch(`/api/tmdb?action=search&query=${encodeURIComponent(name)}`)
            if (r.ok) {
              const d = await r.json()
              const persons = (d.results || []).filter((p: PersonItem & { media_type?: string }) =>
                p.media_type === 'person' || p.known_for_department
              )
              results.push(...persons.slice(0, 3))
            }
          } catch { /* skip */ }
        }
      }

      // Deduplicate
      const seen = new Set<number>()
      const unique: PersonItem[] = []
      for (const p of results) {
        if (seen.has(p.id) || !p.profile_path) continue
        seen.add(p.id)
        unique.push(p)
      }
      setPeople(unique.slice(0, 24))
    } catch (err) {
      console.error('Onboarding people fetch error:', err)
    } finally {
      setLoadingPeople(false)
    }
  }, [])

  useEffect(() => {
    fetchPopularMovies()
    fetchPopularPeople()
  }, [fetchPopularMovies, fetchPopularPeople])

  // ── Person search ──
  useEffect(() => {
    if (!personSearch.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/tmdb?action=search&query=${encodeURIComponent(personSearch)}`)
        if (res.ok) {
          const data = await res.json()
          const persons = (data.results || []).filter((p: PersonItem & { media_type?: string }) =>
            p.media_type === 'person' || p.known_for_department
          )
          setSearchResults(persons.slice(0, 12))
        }
      } catch { /* skip */ }
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [personSearch])

  const handleRate = (movieId: number, score: number) => {
    setRatings(prev => {
      const next = { ...prev }
      if (next[movieId] === score) {
        delete next[movieId]
      } else {
        next[movieId] = score
      }
      return next
    })
  }

  const toggleFan = (personId: number) => {
    setFanSelections(prev => {
      const next = new Set(prev)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }

  const handleComplete = async () => {
    setSaving(true)
    try {
      // Save movie ratings
      for (const [movieIdStr, score] of Object.entries(ratings)) {
        const movieId = Number(movieIdStr)
        const movie = movies.find(m => m.id === movieId)
        if (!movie) continue

        const mediaType = movie.media_type === 'tv' || (movie.name && !movie.title) ? 'tv' : 'movie'

        await supabase.from('movies').upsert({
          id: movieId,
          tmdb_id: movieId,
          title: movie.title || movie.name || '',
          poster_path: movie.poster_path,
          genres: (movie.genre_ids || []).map(id => ({ id })),
          vote_average: movie.vote_average || 0,
          media_type: mediaType,
        }, { onConflict: 'tmdb_id' })

        await supabase.from('watchlists').upsert({
          user_id: userId,
          movie_id: movieId,
          status: 'watched',
          score,
        }, { onConflict: 'user_id,movie_id' })
      }

      // Save FAN! selections
      const allPeople = [...people, ...searchResults]
      for (const personId of fanSelections) {
        const person = allPeople.find(p => p.id === personId)
        if (!person) continue

        const personType = person.known_for_department === 'Directing' ? 'director' : 'actor'

        await supabase.from('fans').upsert({
          user_id: userId,
          person_type: personType,
          person_id: person.id,
          person_name: person.name,
          person_image: person.profile_path,
        }, { onConflict: 'user_id,person_type,person_id' })
      }

      onComplete()
    } catch (err) {
      console.error('Onboarding save error:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Page 0: Intro ──
  if (page === 0) {
    return (
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #0a0b14 0%, #12132a 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{ maxWidth: 400, textAlign: 'center', animation: 'fadeInUp 0.6s ease-out' }}>
          <style>{`
            @keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
            @keyframes pulse-glow { 0%,100% { box-shadow:0 0 20px rgba(108,92,231,0.3); } 50% { box-shadow:0 0 40px rgba(108,92,231,0.6); } }
          `}</style>

          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 48,
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}>
            🎯
          </div>

          <h1 style={{
            fontSize: 28, fontWeight: 800, margin: '0 0 12px',
            background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            あなただけのマッチ度
          </h1>

          <p style={{ fontSize: 15, color: '#aaa', lineHeight: 1.7, margin: '0 0 8px' }}>
            Filmoは、みんなの評価だけでなく
          </p>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>
            「あなたに合うかどうか」
          </p>
          <p style={{ fontSize: 15, color: '#aaa', lineHeight: 1.7, margin: '0 0 24px' }}>
            をAIが判定します。
          </p>

          <div style={{
            background: 'rgba(108,92,231,0.15)', border: '1px solid rgba(108,92,231,0.3)',
            borderRadius: 16, padding: '20px 24px', marginBottom: 32, textAlign: 'left',
          }}>
            <div style={{ fontSize: 14, color: '#ccc', marginBottom: 12, fontWeight: 600 }}>
              2ステップでセットアップ
            </div>
            {[
              { num: 1, text: <>観た映画を<strong style={{ color: '#a29bfe' }}>最低{MIN_RATINGS_FOR_MATCH}本</strong>評価</> },
              { num: 2, text: <>好きな<strong style={{ color: '#a29bfe' }}>監督・俳優</strong>をFAN!登録</> },
            ].map(step => (
              <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  background: '#6c5ce7', color: '#fff', borderRadius: 8,
                  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>{step.num}</span>
                <span style={{ fontSize: 14, color: '#ddd' }}>{step.text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setPage(1)}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
              color: '#fff', fontWeight: 700, fontSize: 17,
              boxShadow: '0 4px 20px rgba(108,92,231,0.4)',
            }}
          >
            さっそく始める
          </button>
        </div>
      </div>
    )
  }

  // ── Page 1: Rate Movies ──
  if (page === 1) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0a0b14', paddingBottom: 120 }}>
        <style>{`
          @keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          .onb-card:hover { transform: translateY(-2px) !important; }
        `}</style>

        {/* Step indicator + Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(10,11,20,0.95)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(108,92,231,0.2)', padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <StepDots current={1} total={2} />
            <span style={{ fontSize: 12, color: '#888' }}>STEP 1/2</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
              観た映画を評価しよう
            </h2>
            <div style={{ fontSize: 14, fontWeight: 700, color: canProceed ? '#2ecc8a' : '#a29bfe' }}>
              {ratedCount} / {RECOMMENDED_RATINGS}
            </div>
          </div>
          <ProgressBar value={ratedCount} max={RECOMMENDED_RATINGS} />
          {ratedCount >= MIN_RATINGS_FOR_MATCH && ratedCount < RECOMMENDED_RATINGS && (
            <div style={{ fontSize: 12, color: '#a29bfe', marginTop: 6 }}>
              あと{RECOMMENDED_RATINGS - ratedCount}本で精度アップ!
            </div>
          )}
          {ratedCount >= RECOMMENDED_RATINGS && (
            <div style={{ fontSize: 12, color: '#2ecc8a', marginTop: 6 }}>
              十分な評価数です!
            </div>
          )}
        </div>

        {/* Movie grid */}
        {loadingMovies ? (
          <LoadingSpinner />
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 16, padding: '20px 16px',
          }}>
            {movies.map((movie, i) => (
              <OnboardingCard
                key={movie.id} movie={movie}
                score={ratings[movie.id] || 0}
                onRate={(s) => handleRate(movie.id, s)}
                delay={i * 30}
              />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(10,11,20,0.95)', backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(108,92,231,0.2)',
          padding: '16px 20px max(16px, env(safe-area-inset-bottom))',
        }}>
          <button
            onClick={() => setPage(2)}
            disabled={!canProceed}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              background: canProceed ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)' : 'rgba(108,92,231,0.2)',
              color: canProceed ? '#fff' : '#666', fontWeight: 700, fontSize: 16,
            }}
          >
            {canProceed
              ? `次へ: FAN!を選ぶ (${ratedCount}本評価済み)`
              : `あと${MIN_RATINGS_FOR_MATCH - ratedCount}本評価してください`
            }
          </button>
        </div>
      </div>
    )
  }

  // ── Page 2: FAN! Selection ──
  const displayPeople = personSearch.trim() ? searchResults : people

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0b14', paddingBottom: 120 }}>
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fan-card:hover { transform: scale(1.03) !important; }
      `}</style>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,11,20,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(108,92,231,0.2)', padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button
            onClick={() => setPage(1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#a29bfe', fontSize: 14, padding: 0, fontWeight: 600,
            }}
          >
            ← 戻る
          </button>
          <div style={{ flex: 1 }} />
          <StepDots current={2} total={2} />
          <span style={{ fontSize: 12, color: '#888' }}>STEP 2/2</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>
          好きな監督・俳優をFAN!登録
        </h2>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 12px' }}>
          FAN!登録するとマッチ度の精度が上がります（スキップも可）
        </p>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input
            value={personSearch}
            onChange={e => setPersonSearch(e.target.value)}
            placeholder="監督・俳優を検索..."
            style={{
              width: '100%', padding: '10px 16px', borderRadius: 10,
              border: '1px solid rgba(108,92,231,0.3)',
              background: 'rgba(18,19,42,0.8)', color: '#e0e0e0', fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
          {searching && (
            <div style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              width: 16, height: 16, border: '2px solid rgba(108,92,231,0.3)',
              borderTopColor: '#6c5ce7', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          )}
        </div>

        {fanSelections.size > 0 && (
          <div style={{ fontSize: 13, color: '#a29bfe', marginTop: 8, fontWeight: 600 }}>
            {fanSelections.size}人選択中
          </div>
        )}
      </div>

      {/* People grid */}
      {loadingPeople && !personSearch.trim() ? (
        <LoadingSpinner />
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 14, padding: '20px 16px',
        }}>
          {displayPeople.map((person, i) => (
            <PersonCard
              key={person.id} person={person}
              selected={fanSelections.has(person.id)}
              onToggle={() => toggleFan(person.id)}
              delay={i * 40}
            />
          ))}
          {displayPeople.length === 0 && personSearch.trim() && !searching && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#666', padding: 40 }}>
              「{personSearch}」の検索結果がありません
            </div>
          )}
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(10,11,20,0.95)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(108,92,231,0.2)',
        padding: '16px 20px max(16px, env(safe-area-inset-bottom))',
        display: 'flex', gap: 12,
      }}>
        <button
          onClick={handleComplete}
          disabled={saving}
          style={{
            flex: 1, padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
            color: '#fff', fontWeight: 700, fontSize: 16,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving
            ? '保存中...'
            : fanSelections.size > 0
              ? `Filmoを始める (${fanSelections.size}人FAN!)`
              : 'スキップしてFilmoを始める'
          }
        </button>
      </div>
    </div>
  )
}

// ── Sub Components ────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i + 1 === current ? 20 : 8, height: 8, borderRadius: 4,
          background: i + 1 <= current ? '#6c5ce7' : 'rgba(255,255,255,0.15)',
          transition: 'all 0.3s',
        }} />
      ))}
    </div>
  )
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 3,
        background: value >= max ? 'linear-gradient(90deg, #2ecc8a, #27ae60)' : 'linear-gradient(90deg, #6c5ce7, #a29bfe)',
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{
        width: 36, height: 36, border: '3px solid rgba(108,92,231,0.3)',
        borderTopColor: '#6c5ce7', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )
}

function OnboardingCard({
  movie, score, onRate, delay,
}: {
  movie: MovieItem; score: number; onRate: (score: number) => void; delay: number
}) {
  const [imgError, setImgError] = useState(false)
  const title = movie.title || movie.name || ''
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4)

  return (
    <div
      className="onb-card"
      style={{
        background: score > 0 ? 'rgba(108,92,231,0.12)' : 'rgba(18,19,42,0.8)',
        borderRadius: 14, overflow: 'hidden',
        border: score > 0 ? '2px solid rgba(108,92,231,0.5)' : '1px solid rgba(255,255,255,0.06)',
        transition: 'all 0.2s ease',
        animation: `fadeInUp 0.4s ease-out ${delay}ms both`,
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', overflow: 'hidden' }}>
        {movie.poster_path && !imgError ? (
          <img src={`${TMDB_IMG}${movie.poster_path}`} alt={title} loading="lazy"
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #12132a, #1e1f3a)', color: '#555', fontSize: 32,
          }}>🎬</div>
        )}
        {score > 0 && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(108,92,231,0.9)', borderRadius: 8, padding: '3px 8px',
            fontSize: 12, fontWeight: 800, color: '#fff',
          }}>{score.toFixed(1)}</div>
        )}
      </div>
      <div style={{ padding: '10px 10px 12px' }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#e0e0e0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2,
        }}>{title}</div>
        {year && <div style={{ fontSize: 11, color: '#777', marginBottom: 8 }}>{year}</div>}
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map(s => (
            <button key={s} onClick={() => onRate(s)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 0,
              color: s <= score ? '#ffd700' : 'rgba(255,255,255,0.15)',
              transition: 'color 0.15s, transform 0.15s',
              transform: s <= score ? 'scale(1.15)' : 'scale(1)',
            }}>★</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PersonCard({
  person, selected, onToggle, delay,
}: {
  person: PersonItem; selected: boolean; onToggle: () => void; delay: number
}) {
  const [imgError, setImgError] = useState(false)
  const dept = person.known_for_department
  const roleLabel = dept === 'Directing' ? '監督' : dept === 'Writing' ? '脚本' : '俳優'
  const knownFor = person.known_for?.map(k => k.title || k.name).filter(Boolean).slice(0, 2).join(', ') || ''

  return (
    <div
      className="fan-card"
      onClick={onToggle}
      style={{
        background: selected ? 'rgba(108,92,231,0.18)' : 'rgba(18,19,42,0.8)',
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        border: selected ? '2px solid rgba(108,92,231,0.6)' : '1px solid rgba(255,255,255,0.06)',
        transition: 'all 0.2s ease',
        animation: `fadeInUp 0.4s ease-out ${delay}ms both`,
        textAlign: 'center',
        padding: '16px 8px',
      }}
    >
      <div style={{
        position: 'relative', width: 80, height: 80, borderRadius: '50%',
        overflow: 'hidden', margin: '0 auto 10px',
        border: selected ? '3px solid #6c5ce7' : '3px solid transparent',
        transition: 'border 0.2s',
      }}>
        {person.profile_path && !imgError ? (
          <img src={`${TMDB_IMG_PROFILE}${person.profile_path}`} alt={person.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#1e1f3a', color: '#555', fontSize: 24,
          }}>👤</div>
        )}
        {selected && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 24, height: 24, borderRadius: '50%',
            background: '#6c5ce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff', border: '2px solid #0a0b14',
          }}>✓</div>
        )}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: selected ? '#a29bfe' : '#e0e0e0',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3,
      }}>{person.name}</div>
      <div style={{
        fontSize: 11, color: '#6c5ce7', fontWeight: 600, marginBottom: 3,
        background: 'rgba(108,92,231,0.15)', borderRadius: 4, display: 'inline-block', padding: '1px 6px',
      }}>{roleLabel}</div>
      {knownFor && (
        <div style={{ fontSize: 10, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {knownFor}
        </div>
      )}
    </div>
  )
}
