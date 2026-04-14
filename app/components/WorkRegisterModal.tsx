'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { awardContributionPoints, POINT_CONFIG } from '../lib/points'
import { showToast } from '../lib/toast'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

interface WorkRegisterModalProps {
  userId: string
  initialQuery: string
  onClose: () => void
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}

interface TMDBResult {
  id: number
  title?: string
  name?: string
  media_type: string
  poster_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average: number
}

interface LocalResult {
  id: number
  title: string
  media_type: string
  release_date: string | null
  poster_path: string | null
  data_source: string
}

type Step = 'search' | 'form' | 'done'

export default function WorkRegisterModal({ userId, initialQuery, onClose, onOpenWork }: WorkRegisterModalProps) {
  const [step, setStep] = useState<Step>('search')
  const [query, setQuery] = useState(initialQuery)
  const [tmdbResults, setTmdbResults] = useState<TMDBResult[]>([])
  const [localResults, setLocalResults] = useState<LocalResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  // フォーム
  const [title, setTitle] = useState(initialQuery)
  const [originalTitle, setOriginalTitle] = useState('')
  const [mediaType, setMediaType] = useState<'movie' | 'tv' | 'anime'>('tv')
  const [year, setYear] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdWorkId, setCreatedWorkId] = useState<number | null>(null)

  // 初回検索
  useEffect(() => {
    if (initialQuery.trim()) {
      handleSearch()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return

    setSearching(true)
    setSearched(false)
    try {
      // TMDB検索 + ローカルDB検索を並列実行
      const [tmdbRes, localRes] = await Promise.all([
        fetch(`/api/tmdb?action=search&query=${encodeURIComponent(q)}`).then(r => r.json()),
        fetch(`/api/works?action=search_local&query=${encodeURIComponent(q)}`).then(r => r.json()),
      ])

      const tmdb = (tmdbRes.results || [])
        .filter((r: TMDBResult) => r.media_type === 'movie' || r.media_type === 'tv')
        .slice(0, 10)
      setTmdbResults(tmdb)
      setLocalResults(localRes.results || [])
      setSearched(true)
    } catch {
      setTmdbResults([])
      setLocalResults([])
      setSearched(true)
    } finally {
      setSearching(false)
    }
  }, [query])

  const handleRegister = useCallback(async () => {
    if (!title.trim()) return
    setSubmitting(true)

    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      const res = await fetch('/api/works', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'register',
          userId,
          title: title.trim(),
          originalTitle: originalTitle.trim() || undefined,
          mediaType,
          year: year ? Number(year) : undefined,
          description: description.trim() || undefined,
        }),
      })

      if (res.status === 409) {
        const data = await res.json()
        showToast(data.message || '同じタイトルの作品が既に登録されています')
        // 重複候補をTMDB/ローカル結果に反映して検索ステップに戻す
        if (data.duplicates) {
          const tmdbDups = data.duplicates.filter((d: LocalResult) => d.data_source === 'tmdb')
          const localDups = data.duplicates.filter((d: LocalResult) => d.data_source !== 'tmdb')
          if (tmdbDups.length > 0) setTmdbResults(tmdbDups.map((d: LocalResult) => ({ ...d, media_type: d.media_type })))
          if (localDups.length > 0) setLocalResults(localDups)
          setSearched(true)
          setStep('search')
        }
        setSubmitting(false)
        return
      }

      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || '登録に失敗しました')
        setSubmitting(false)
        return
      }

      const data = await res.json()
      setCreatedWorkId(data.work.id)

      // ポイント付与
      await awardContributionPoints(
        userId,
        'register_work',
        POINT_CONFIG.REGISTER_WORK,
        `作品「${title.trim()}」を登録`,
        undefined,
        data.work.id,
      )

      setStep('done')
      showToast(`「${title.trim()}」を登録しました！ +${POINT_CONFIG.REGISTER_WORK}pt`)
    } catch {
      showToast('登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }, [userId, title, originalTitle, mediaType, year, description])

  const handleRequest = useCallback(async () => {
    if (!title.trim()) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/works', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          userId,
          title: title.trim(),
          originalTitle: originalTitle.trim() || undefined,
          mediaType,
          year: year ? Number(year) : undefined,
          description: description.trim() || undefined,
        }),
      })

      if (!res.ok) {
        showToast('リクエストに失敗しました')
        setSubmitting(false)
        return
      }

      // ポイント付与
      await awardContributionPoints(
        userId,
        'request_work',
        POINT_CONFIG.REQUEST_WORK,
        `作品「${title.trim()}」をリクエスト`,
      )

      showToast(`リクエストを送信しました！ +${POINT_CONFIG.REQUEST_WORK}pt`)
      onClose()
    } catch {
      showToast('リクエストに失敗しました')
    } finally {
      setSubmitting(false)
    }
  }, [userId, title, originalTitle, mediaType, year, description, onClose])

  const getTitle = (r: TMDBResult) => r.title || r.name || ''
  const getYear = (r: TMDBResult) => (r.release_date || r.first_air_date || '').substring(0, 4)

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <button onClick={onClose} style={s.closeBtn}>×</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)' }}>
            {step === 'search' ? '作品を探す' : step === 'form' ? '作品を登録' : '登録完了'}
          </span>
          <div style={{ width: 40 }} />
        </div>

        {/* Step: Search */}
        {step === 'search' && (
          <div style={s.body}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="タイトルを入力..."
                style={s.input}
              />
              <button onClick={handleSearch} disabled={searching} style={s.primaryBtn}>
                {searching ? '...' : '検索'}
              </button>
            </div>

            {searching && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--fm-text-sub)' }}>
                検索中...
              </div>
            )}

            {searched && !searching && (
              <>
                {/* TMDB Results */}
                {tmdbResults.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text-sub)', marginBottom: 8 }}>
                      TMDBの検索結果（こちらにありませんか？）
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tmdbResults.map(r => (
                        <div
                          key={`tmdb-${r.id}`}
                          style={s.resultCard}
                          onClick={() => {
                            onOpenWork(r.id, r.media_type as 'movie' | 'tv')
                            onClose()
                          }}
                        >
                          {r.poster_path ? (
                            <img src={`${TMDB_IMG}/w92${r.poster_path}`} alt={getTitle(r)} style={s.resultPoster} />
                          ) : (
                            <div style={{ ...s.resultPoster, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)' }}>🎬</div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getTitle(r)}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>
                              {getYear(r)} / {r.media_type === 'movie' ? '映画' : 'ドラマ'}
                              {r.vote_average > 0 && ` / ★${r.vote_average.toFixed(1)}`}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--fm-accent)' }}>→</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Local (user-created) results */}
                {localResults.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text-sub)', marginBottom: 8 }}>
                      ユーザー登録作品
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {localResults.map(r => (
                        <div
                          key={`local-${r.id}`}
                          style={s.resultCard}
                          onClick={() => {
                            onOpenWork(r.id, r.media_type as 'movie' | 'tv')
                            onClose()
                          }}
                        >
                          <div style={{ ...s.resultPoster, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--fm-text-muted)' }}>📝</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.title}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>
                              {r.release_date?.substring(0, 4) || '---'} / ユーザー登録
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--fm-accent)' }}>→</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proceed to registration */}
                <div style={s.notFoundBox}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', marginBottom: 8 }}>
                    お探しの作品がありませんか？
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 12 }}>
                    見つからない作品を登録して、記録を始めましょう。登録すると{POINT_CONFIG.REGISTER_WORK}ptもらえます！
                  </div>
                  <button
                    onClick={() => { setTitle(query); setStep('form') }}
                    style={s.primaryBtn}
                  >
                    この作品を登録する
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step: Form */}
        {step === 'form' && (
          <div style={s.body}>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--fm-bg-hover)', marginBottom: 16, fontSize: 12, color: 'var(--fm-text-sub)', lineHeight: 1.5 }}>
              💡 重複を防ぐため、タイトルと原題の両方を入力してください。例: タイトル「半沢直樹」、原題「Hanzawa Naoki」
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>タイトル *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="作品タイトル"
                style={s.input}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>原題 / Other Language Title</label>
              <input
                type="text"
                value={originalTitle}
                onChange={e => setOriginalTitle(e.target.value)}
                placeholder="別の言語でのタイトル（例: Hanzawa Naoki）"
                style={s.input}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>種類</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['tv', 'ドラマ'], ['movie', '映画'], ['anime', 'アニメ']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setMediaType(val)}
                    style={s.tab(mediaType === val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>公開年（オプション）</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="2024"
                min="1900"
                max="2030"
                style={{ ...s.input, width: 120 }}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>説明（オプション）</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="あらすじや補足情報..."
                style={s.textarea}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={handleRegister}
                disabled={submitting || !title.trim()}
                style={{ ...s.primaryBtn, flex: 1, opacity: submitting || !title.trim() ? 0.5 : 1 }}
              >
                {submitting ? '登録中...' : `登録して記録開始 (+${POINT_CONFIG.REGISTER_WORK}pt)`}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                onClick={handleRequest}
                disabled={submitting || !title.trim()}
                style={{ background: 'none', border: 'none', color: 'var(--fm-text-sub)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
              >
                管理者にリクエストだけ送る (+{POINT_CONFIG.REQUEST_WORK}pt)
              </button>
            </div>

            <button
              onClick={() => setStep('search')}
              style={{ background: 'none', border: 'none', color: 'var(--fm-text-muted)', fontSize: 13, cursor: 'pointer', marginTop: 8, display: 'block' }}
            >
              ← 検索に戻る
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div style={{ ...s.body, textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 8 }}>
              登録完了！
            </div>
            <div style={{ fontSize: 14, color: 'var(--fm-text-sub)', marginBottom: 24 }}>
              「{title}」を登録しました。さっそく記録を始めましょう！
            </div>
            <button
              onClick={() => {
                if (createdWorkId !== null) {
                  onOpenWork(createdWorkId, mediaType === 'movie' ? 'movie' : 'tv')
                }
                onClose()
              }}
              style={s.primaryBtn}
            >
              この作品を開く
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    padding: 16, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'var(--fm-bg)', borderRadius: 16,
    width: '100%', maxWidth: 480, maxHeight: '85dvh',
    overflow: 'hidden', display: 'flex', flexDirection: 'column' as const,
    border: '1px solid var(--fm-border)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid var(--fm-border)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--fm-text-sub)',
    fontSize: 24, cursor: 'pointer', width: 40, height: 40,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: {
    padding: 16, overflowY: 'auto' as const, flex: 1,
  },
  input: {
    flex: 1, padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
    color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' as const,
    minHeight: 44,
  },
  textarea: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
    color: 'var(--fm-text)', fontSize: 14, minHeight: 80,
    resize: 'vertical' as const, boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '10px 20px', borderRadius: 10, border: 'none',
    background: 'var(--fm-accent)', color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44,
  },
  tab: (active: boolean) => ({
    padding: '6px 14px', borderRadius: 16, border: 'none',
    background: active ? 'var(--fm-accent)' : 'var(--fm-bg-hover)',
    color: active ? '#fff' : 'var(--fm-text-sub)',
    fontSize: 13, cursor: 'pointer', fontWeight: active ? 600 : 400,
    minHeight: 32,
  }),
  formGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--fm-text-sub)', marginBottom: 6,
  },
  resultCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
    background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
    transition: 'background 0.15s',
  },
  resultPoster: {
    width: 40, height: 56, borderRadius: 4, objectFit: 'cover' as const,
    background: 'var(--fm-bg-hover)', flexShrink: 0,
  },
  notFoundBox: {
    padding: 20, borderRadius: 12,
    background: 'var(--fm-bg-card)', border: '1px solid var(--fm-accent)',
    textAlign: 'center' as const,
  },
}
