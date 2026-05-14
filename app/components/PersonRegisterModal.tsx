'use client'

/**
 * 人物 (監督・俳優・脚本家) 登録モーダル。
 *
 * フロー: 検索 → (見つからなければ) フォーム → 完了
 * 既存の WorkRegisterModal と同じステップ構造。
 */
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import { POINT_CONFIG } from '../lib/points'
import { trackPersonRegistered } from '../lib/analytics'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

interface Props {
  userId: string
  initialQuery: string
  /** 推奨役職 (PersonSearch の filterDepartment と揃える) */
  suggestedDepartment?: 'Directing' | 'Writing' | 'Acting'
  onClose: () => void
  /** 登録 / 既存ヒット時に開く動作 (親側でモーダル / ナビゲーションする) */
  onOpenPerson: (id: number) => void
}

interface TmdbPersonResult {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string | null
  known_for: { title?: string; name?: string }[]
}

interface LocalPersonResult {
  id: number
  name: string
  profile_path: string | null
  known_for: string[] | null
  data_source: string
}

type Step = 'search' | 'form' | 'done'

const DEPARTMENTS = [
  { value: 'Directing', label: '監督' },
  { value: 'Writing', label: '脚本家' },
  { value: 'Acting', label: '俳優' },
] as const

export default function PersonRegisterModal({
  userId,
  initialQuery,
  suggestedDepartment,
  onClose,
  onOpenPerson,
}: Props) {
  const [step, setStep] = useState<Step>('search')
  const [query, setQuery] = useState(initialQuery)
  const [tmdbResults, setTmdbResults] = useState<TmdbPersonResult[]>([])
  const [localResults, setLocalResults] = useState<LocalPersonResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  // フォーム
  const [name, setName] = useState(initialQuery)
  const [originalName, setOriginalName] = useState('')
  const [knownForDepartment, setKnownForDepartment] = useState<'Directing' | 'Writing' | 'Acting'>(suggestedDepartment || 'Directing')
  const [birthday, setBirthday] = useState('')
  const [placeOfBirth, setPlaceOfBirth] = useState('')
  const [biography, setBiography] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [homepage, setHomepage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdId, setCreatedId] = useState<number | null>(null)

  useEffect(() => {
    if (initialQuery.trim()) handleSearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSearched(false)
    try {
      const [tmdbRes, localRes] = await Promise.all([
        fetch(`/api/tmdb?action=search_person&query=${encodeURIComponent(q)}`).then(r => r.json()),
        // persons テーブル直接の検索 API は無いので supabase で軽量検索 (RLS で SELECT 全許可)
        supabase
          .from('persons')
          .select('id, name, profile_path, known_for, data_source')
          .ilike('name', `%${q}%`)
          .limit(8),
      ])
      const tmdb = ((tmdbRes.results || []) as TmdbPersonResult[]).slice(0, 8)
      setTmdbResults(tmdb)
      setLocalResults(((localRes.data as LocalPersonResult[] | null) || []))
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
    if (!name.trim()) return
    setSubmitting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) {
        showToast('ログインが必要です')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/persons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'register',
          name: name.trim(),
          originalName: originalName.trim() || undefined,
          knownForDepartment,
          birthday: birthday || undefined,
          placeOfBirth: placeOfBirth.trim() || undefined,
          biography: biography.trim() || undefined,
          profileUrl: profileUrl.trim() || undefined,
          homepage: homepage.trim() || undefined,
        }),
      })

      if (res.status === 409) {
        const data = await res.json()
        showToast(data.message || '同じ名前の人物が既に登録されています')
        if (data.duplicates) {
          setLocalResults(data.duplicates as LocalPersonResult[])
          setStep('search')
          setSearched(true)
        }
        setSubmitting(false)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || '登録に失敗しました')
        setSubmitting(false)
        return
      }

      const data = await res.json()
      setCreatedId(data.person.id)
      trackPersonRegistered(data.person.id, knownForDepartment)
      setStep('done')
      showToast(`「${name.trim()}」を登録しました！ +${POINT_CONFIG.REGISTER_WORK}pt`)
    } catch {
      showToast('登録に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }, [name, originalName, knownForDepartment, birthday, placeOfBirth, biography, profileUrl, homepage])

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <button onClick={onClose} style={s.closeBtn} aria-label="閉じる">×</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)' }}>
            {step === 'search' ? '人物を探す' : step === 'form' ? '人物を登録' : '登録完了'}
          </span>
          <div style={{ width: 40 }} />
        </div>

        {step === 'search' && (
          <div style={s.body}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="名前を入力 (例: 泉原航一)"
                style={s.input}
              />
              <button onClick={handleSearch} disabled={searching || !query.trim()} style={s.primaryBtn}>
                {searching ? '…' : '検索'}
              </button>
            </div>

            {searching && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--fm-text-sub)' }}>検索中…</div>
            )}

            {searched && !searching && (
              <>
                {tmdbResults.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={s.sectionLabel}>TMDB の検索結果（こちらにありませんか？）</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tmdbResults.map(p => (
                        <button
                          key={`tmdb-${p.id}`}
                          onClick={() => { onOpenPerson(p.id); onClose() }}
                          style={s.resultCard}
                        >
                          {p.profile_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${TMDB_IMG}/w92${p.profile_path}`} alt={p.name} style={s.resultThumb} />
                          ) : (
                            <div style={{ ...s.resultThumb, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--fm-text-muted)' }}>👤</div>
                          )}
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>
                              {p.known_for_department || '人物'}
                              {p.known_for?.length ? ` / ${(p.known_for[0].title || p.known_for[0].name || '')}` : ''}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {localResults.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={s.sectionLabel}>Filmo に登録済み</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {localResults.map(p => (
                        <button
                          key={`local-${p.id}`}
                          onClick={() => { onOpenPerson(p.id); onClose() }}
                          style={s.resultCard}
                        >
                          {p.profile_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.profile_path.startsWith('http') ? p.profile_path : `${TMDB_IMG}/w92${p.profile_path}`} alt={p.name} style={s.resultThumb} />
                          ) : (
                            <div style={{ ...s.resultThumb, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--fm-text-muted)' }}>👤</div>
                          )}
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>
                              {p.known_for?.[0] || '人物'} / {p.data_source === 'user' ? 'ユーザー登録' : 'TMDB'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={s.notFoundBox}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)', marginBottom: 6 }}>
                    お探しの人物が見つからない場合
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 12 }}>
                    Filmo に新規登録できます。後から編集も可能です。
                  </div>
                  <button
                    onClick={() => { setName(query); setStep('form') }}
                    style={s.primaryBtn}
                  >
                    新しく登録する
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'form' && (
          <div style={s.body}>
            <div style={s.formGroup}>
              <label style={s.label}>名前 <span style={{ color: '#e74c3c' }}>*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                placeholder="泉原航一"
                style={s.input}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>役割</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DEPARTMENTS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setKnownForDepartment(d.value)}
                    style={s.tab(knownForDepartment === d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>別名・原語表記（オプション）</label>
              <input
                type="text"
                value={originalName}
                onChange={e => setOriginalName(e.target.value)}
                maxLength={100}
                placeholder="Koichi Izuhara"
                style={s.input}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>生年月日（オプション）</label>
              <input
                type="date"
                value={birthday}
                onChange={e => setBirthday(e.target.value)}
                style={s.input}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>出身地（オプション）</label>
              <input
                type="text"
                value={placeOfBirth}
                onChange={e => setPlaceOfBirth(e.target.value)}
                maxLength={200}
                placeholder="大阪府岸和田市"
                style={s.input}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>プロフィール画像 URL（オプション）</label>
              <input
                type="url"
                value={profileUrl}
                onChange={e => setProfileUrl(e.target.value)}
                placeholder="https://..."
                style={s.input}
              />
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 4 }}>
                公式サイト等で公開されている画像のURLを貼り付けてください
              </div>
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>公式サイト（オプション）</label>
              <input
                type="url"
                value={homepage}
                onChange={e => setHomepage(e.target.value)}
                placeholder="https://..."
                style={s.input}
              />
            </div>

            <div style={s.formGroup}>
              <label style={s.label}>説明（オプション）</label>
              <textarea
                value={biography}
                onChange={e => setBiography(e.target.value)}
                maxLength={3000}
                placeholder="経歴・代表作・受賞歴など"
                rows={4}
                style={s.textarea}
              />
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 4, textAlign: 'right' }}>
                {biography.length} / 3000
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={handleRegister}
                disabled={submitting || !name.trim()}
                style={{ ...s.primaryBtn, flex: 1, opacity: submitting || !name.trim() ? 0.5 : 1 }}
              >
                {submitting ? '登録中…' : `登録する (+${POINT_CONFIG.REGISTER_WORK}pt)`}
              </button>
            </div>

            <button
              onClick={() => setStep('search')}
              style={{ background: 'none', border: 'none', color: 'var(--fm-text-muted)', fontSize: 13, cursor: 'pointer', marginTop: 10, display: 'block' }}
            >
              ← 検索に戻る
            </button>
          </div>
        )}

        {step === 'done' && (
          <div style={{ ...s.body, textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 8 }}>
              登録完了！
            </div>
            <div style={{ fontSize: 14, color: 'var(--fm-text-sub)', marginBottom: 24 }}>
              「{name}」を登録しました。<br />
              さっそくレビューを書いてみよう。
            </div>
            <button
              onClick={() => {
                if (createdId !== null) onOpenPerson(createdId)
                onClose()
              }}
              style={s.primaryBtn}
            >
              この人物を開く
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles (WorkRegisterModal と同設計) ─────────────────────────────────────
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
  sectionLabel: {
    fontSize: 13, fontWeight: 600, color: 'var(--fm-text-sub)', marginBottom: 8,
  },
  input: {
    flex: 1, width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
    color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' as const,
    minHeight: 44, fontFamily: 'inherit',
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
    marginBottom: 14,
  },
  label: {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--fm-text-sub)', marginBottom: 6,
  },
  resultCard: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
    background: 'var(--fm-bg-card)', border: '1px solid var(--fm-border)',
    width: '100%', textAlign: 'left' as const, fontFamily: 'inherit',
  },
  resultThumb: {
    width: 40, height: 56, borderRadius: 4, objectFit: 'cover' as const,
    background: 'var(--fm-bg-hover)', flexShrink: 0,
  },
  notFoundBox: {
    padding: 20, borderRadius: 12,
    background: 'var(--fm-bg-card)', border: '1px solid var(--fm-accent)',
    textAlign: 'center' as const,
  },
}
