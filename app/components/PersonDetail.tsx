'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

interface PersonDetailProps {
  personId: number
  userId: string
  onClose: () => void
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}

interface Credit {
  id: number
  title?: string
  name?: string
  media_type: 'movie' | 'tv'
  poster_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
  character?: string
  job?: string
  department?: string
  episode_count?: number
}

interface PersonData {
  id: number
  name: string
  biography: string
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  profile_path: string | null
  known_for_department: string
  also_known_as: string[]
  combined_credits: {
    cast: Credit[]
    crew: Credit[]
  }
}

type FilterTab = 'all' | 'movie' | 'tv'
type RoleTab = 'cast' | 'crew'

export default function PersonDetail({ personId, userId, onClose, onOpenWork }: PersonDetailProps) {
  const [person, setPerson] = useState<PersonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [roleTab, setRoleTab] = useState<RoleTab>('cast')
  const [isFan, setIsFan] = useState(false)
  const [showFullBio, setShowFullBio] = useState(false)

  useEffect(() => {
    setLoading(true)
    setPerson(null)
    setShowFullBio(false)

    const fetchPerson = async () => {
      try {
        const res = await fetch(`/api/tmdb?action=person&id=${personId}`)
        const data = await res.json()
        setPerson(data)

        // Determine default roleTab based on known_for_department
        if (data.known_for_department === 'Directing' || data.known_for_department === 'Writing') {
          setRoleTab('crew')
        } else {
          setRoleTab('cast')
        }
      } catch (e) {
        console.error('Failed to load person:', e)
      } finally {
        setLoading(false)
      }
    }

    const checkFan = async () => {
      const { data } = await supabase
        .from('fans')
        .select('id')
        .eq('user_id', userId)
        .eq('person_id', personId)
        .maybeSingle()
      setIsFan(!!data)
    }

    fetchPerson()
    checkFan()
  }, [personId, userId])

  const handleToggleFan = useCallback(async () => {
    if (!person) return
    if (isFan) {
      await supabase.from('fans').delete().eq('user_id', userId).eq('person_id', personId)
      setIsFan(false)
    } else {
      await supabase.from('fans').insert({
        user_id: userId,
        person_id: personId,
        person_name: person.name,
        person_image: person.profile_path,
        person_type: person.known_for_department === 'Directing' ? 'director' : 'actor',
      })
      setIsFan(true)
    }
  }, [person, isFan, userId, personId])

  // Deduplicate and sort credits
  const getFilteredCredits = useCallback((): Credit[] => {
    if (!person) return []

    const credits = roleTab === 'cast'
      ? person.combined_credits.cast
      : person.combined_credits.crew

    // Filter by media type
    const filtered = filterTab === 'all'
      ? credits
      : credits.filter(c => c.media_type === filterTab)

    // Deduplicate by id (keep first occurrence)
    const seen = new Set<number>()
    const deduped = filtered.filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    // Sort by date (newest first)
    return deduped.sort((a, b) => {
      const dateA = a.release_date || a.first_air_date || ''
      const dateB = b.release_date || b.first_air_date || ''
      return dateB.localeCompare(dateA)
    })
  }, [person, filterTab, roleTab])

  const credits = getFilteredCredits()

  const getAge = (birthday: string, deathday?: string | null) => {
    const end = deathday ? new Date(deathday) : new Date()
    const birth = new Date(birthday)
    let age = end.getFullYear() - birth.getFullYear()
    const m = end.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) age--
    return age
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }

  const getYear = (credit: Credit) => {
    const date = credit.release_date || credit.first_air_date
    return date ? date.substring(0, 4) : '---'
  }

  const castCount = person?.combined_credits.cast.length || 0
  const crewCount = person?.combined_credits.crew.length || 0

  if (loading) {
    return (
      <div style={s.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>👤</div>
            <div style={{ color: 'var(--fm-text-sub)' }}>読み込み中...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!person) {
    return (
      <div style={s.container}>
        <button onClick={onClose} style={s.backBtn}>←</button>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fm-text-sub)' }}>
          人物情報を取得できませんでした
        </div>
      </div>
    )
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={onClose} style={s.backBtn}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)' }}>{person.name}</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Profile section */}
      <div style={s.profileSection}>
        <div style={s.profileRow}>
          {person.profile_path ? (
            <img src={`${TMDB_IMG}/w185${person.profile_path}`} alt={person.name} style={s.profileImg} />
          ) : (
            <div style={{ ...s.profileImg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: 'var(--fm-text-muted)' }}>👤</div>
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fm-text)', margin: 0 }}>{person.name}</h1>
            {person.also_known_as.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginTop: 4 }}>
                {person.also_known_as[0]}
              </div>
            )}
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={s.badge}>
                {person.known_for_department === 'Acting' ? '俳優' :
                 person.known_for_department === 'Directing' ? '監督' :
                 person.known_for_department === 'Writing' ? '脚本' :
                 person.known_for_department || '---'}
              </span>
              {person.birthday && (
                <span style={s.badge}>
                  {getAge(person.birthday, person.deathday)}歳
                </span>
              )}
            </div>
            <button onClick={handleToggleFan} style={s.fanBtn(isFan)}>
              {isFan ? 'Fan! ✓' : 'Fan!'}
            </button>
          </div>
        </div>

        {/* Bio info */}
        <div style={s.infoGrid}>
          {person.birthday && (
            <>
              <span style={s.infoLabel}>生年月日</span>
              <span style={s.infoValue}>
                {formatDate(person.birthday)}
                {person.deathday && ` - ${formatDate(person.deathday)}`}
              </span>
            </>
          )}
          {person.place_of_birth && (
            <>
              <span style={s.infoLabel}>出身地</span>
              <span style={s.infoValue}>{person.place_of_birth}</span>
            </>
          )}
        </div>

        {/* Biography */}
        {person.biography && (
          <div style={{ marginTop: 12 }}>
            <p style={{
              fontSize: 14, color: 'var(--fm-text-sub)', lineHeight: 1.7, margin: 0,
              ...(showFullBio ? {} : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
            }}>
              {person.biography}
            </p>
            {person.biography.length > 150 && (
              <button
                onClick={() => setShowFullBio(!showFullBio)}
                style={{ background: 'none', border: 'none', color: 'var(--fm-accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}
              >
                {showFullBio ? '閉じる' : '続きを読む'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filmography */}
      <div style={{ padding: '0 16px 16px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          🎬 フィルモグラフィー
        </h3>

        {/* Role tabs (cast/crew) */}
        {crewCount > 0 && castCount > 0 && (
          <div style={s.tabRow}>
            <button style={s.tab(roleTab === 'cast')} onClick={() => setRoleTab('cast')}>
              出演 ({castCount})
            </button>
            <button style={s.tab(roleTab === 'crew')} onClick={() => setRoleTab('crew')}>
              スタッフ ({crewCount})
            </button>
          </div>
        )}

        {/* Filter tabs (all/movie/tv) */}
        <div style={s.tabRow}>
          <button style={s.tab(filterTab === 'all')} onClick={() => setFilterTab('all')}>
            すべて ({credits.length})
          </button>
          <button style={s.tab(filterTab === 'movie')} onClick={() => setFilterTab('movie')}>
            映画
          </button>
          <button style={s.tab(filterTab === 'tv')} onClick={() => setFilterTab('tv')}>
            ドラマ
          </button>
        </div>

        {/* Credits grid */}
        <div style={s.creditsGrid}>
          {credits.map(credit => (
            <div
              key={`${credit.media_type}-${credit.id}`}
              style={s.creditCard}
              onClick={() => onOpenWork(credit.id, credit.media_type)}
            >
              {credit.poster_path ? (
                <img src={`${TMDB_IMG}/w342${credit.poster_path}`} alt={credit.title || credit.name} style={s.creditPoster} />
              ) : (
                <div style={{ ...s.creditPoster, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: 'var(--fm-text-muted)' }}>🎬</div>
              )}
              <div style={{ padding: '8px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {credit.title || credit.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 2 }}>
                  {getYear(credit)}
                  {roleTab === 'cast' && credit.character && ` / ${credit.character}`}
                  {roleTab === 'crew' && credit.job && ` / ${credit.job}`}
                </div>
                {credit.vote_average > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--fm-accent)', marginTop: 2, fontWeight: 600 }}>
                    ★ {credit.vote_average.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {credits.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--fm-text-muted)', fontSize: 14 }}>
            該当する作品がありません
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  container: {
    position: 'fixed' as const, inset: 0, zIndex: 1000,
    background: 'var(--fm-bg)', overflowY: 'auto' as const,
  },
  header: {
    position: 'sticky' as const, top: 0, zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: 'var(--fm-bg)',
    borderBottom: '1px solid var(--fm-border)',
    backdropFilter: 'blur(12px)',
  },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--fm-text)',
    fontSize: 20, cursor: 'pointer', width: 40, height: 40,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%',
  },
  profileSection: {
    padding: '20px 16px',
  },
  profileRow: {
    display: 'flex', gap: 16, alignItems: 'flex-start',
  },
  profileImg: {
    width: 100, height: 100, borderRadius: 12, objectFit: 'cover' as const,
    background: 'var(--fm-bg-hover)', flexShrink: 0,
  },
  badge: {
    display: 'inline-block', padding: '2px 10px', borderRadius: 12,
    background: 'var(--fm-bg-hover)', color: 'var(--fm-text-sub)',
    fontSize: 12, border: '1px solid var(--fm-border)',
  },
  fanBtn: (active: boolean) => ({
    marginTop: 10, padding: '6px 16px', borderRadius: 16, fontSize: 13,
    border: active ? 'none' : '1px solid var(--fm-accent)',
    background: active ? 'var(--fm-accent)' : 'transparent',
    color: active ? '#fff' : 'var(--fm-accent)', cursor: 'pointer',
    fontWeight: 600, minHeight: 32,
  }),
  infoGrid: {
    display: 'grid', gridTemplateColumns: '80px 1fr',
    gap: '6px 12px', fontSize: 13, marginTop: 16,
  },
  infoLabel: {
    color: 'var(--fm-text-muted)', fontWeight: 500,
  },
  infoValue: {
    color: 'var(--fm-text)', fontWeight: 400,
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
  creditsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
  },
  creditCard: {
    cursor: 'pointer', borderRadius: 8, overflow: 'hidden',
    transition: 'transform 0.2s',
  },
  creditPoster: {
    width: '100%', aspectRatio: '2/3', borderRadius: 8,
    objectFit: 'cover' as const, background: 'var(--fm-bg-card)',
    display: 'block',
  },
}
