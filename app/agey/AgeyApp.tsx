'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import LoginPrompt from '../components/LoginPrompt'
import {
  resolveAge, daysUntilNextBirthday, type AgeSource,
} from '../lib/agey/age'

// ====================================================
// 型
// ====================================================
interface Person {
  id: string
  name: string
  nickname: string | null
  reading: string | null
  relation: string | null
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  approx_age: number | null
  approx_age_as_of: string | null
  note: string | null
  tags: string[]
  emoji: string | null
  color_tag: string | null
}

type SortMode = 'recent' | 'oldest' | 'youngest' | 'name'

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'recent', label: '登録順' },
  { key: 'oldest', label: '年齢が高い順' },
  { key: 'youngest', label: '年齢が低い順' },
  { key: 'name', label: '名前順' },
]

const EMOJI_PRESETS = ['👶', '🧒', '👦', '👧', '🧑', '👨', '👩', '👴', '👵', '🧑‍💼', '🐱', '🎂']
const COLOR_PRESETS = ['#ff7aae', '#ffd24a', '#6cf2ff', '#a29bfe', '#7bed9f', '#ff9f43', '#ff6b6b', '#54a0ff']
const RELATION_PRESETS = ['会社の同僚', 'ママ友', '子の友達', '兄弟', '親戚', 'ご近所']

const BG = '#0a0b14'

type AgeMode = 'exact' | 'approx' | 'none'

// ====================================================
// モーダルの下書き
// ====================================================
interface Draft {
  id: string | null // null = 新規
  name: string
  nickname: string
  reading: string
  relation: string
  ageMode: AgeMode
  birthDate: string // 'YYYY-MM-DD' (exact)
  approxAge: string // 数値文字列 (approx)
  note: string
  tags: string[]
  emoji: string | null
  color: string | null
}

function emptyDraft(): Draft {
  return {
    id: null, name: '', nickname: '', reading: '', relation: '',
    ageMode: 'exact', birthDate: '', approxAge: '',
    note: '', tags: [], emoji: null, color: null,
  }
}

function toAgeSource(p: Person): AgeSource {
  return {
    birth_year: p.birth_year,
    birth_month: p.birth_month,
    birth_day: p.birth_day,
    approx_age: p.approx_age,
    approx_age_as_of: p.approx_age_as_of,
  }
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ====================================================
// メイン
// ====================================================
export default function AgeyApp() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState<Person[]>([])

  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('recent')

  // 「いま」を 60 秒ごとに更新して年齢をリアルタイム表示
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = window.setInterval(tick, 60_000)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // ────────────────────────────
  // 初期ロード
  // ────────────────────────────
  const loadPeople = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('agey_people')
      .select('id, name, nickname, reading, relation, birth_year, birth_month, birth_day, approx_age, approx_age_as_of, note, tags, emoji, color_tag')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[agey] load failed', error)
      return
    }
    setPeople((data ?? []) as Person[])
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (!session?.user) {
          setAuthed(false)
          setLoading(false)
          return
        }
        setAuthed(true)
        setUserId(session.user.id)
        await loadPeople(session.user.id)
      } catch (e) {
        console.error('[agey] init failed', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [loadPeople])

  // ────────────────────────────
  // タグ一覧
  // ────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>()
    people.forEach(p => p.tags.forEach(t => set.add(t)))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'))
  }, [people])

  // ────────────────────────────
  // 検索 + 絞り込み + ソート
  // ────────────────────────────
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = people.filter(p => {
      if (activeTag && !p.tags.includes(activeTag)) return false
      if (!q) return true
      const hay = [p.name, p.nickname, p.reading, p.relation, p.note, ...p.tags]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
    list = [...list]
    if (sortMode === 'name') {
      list.sort((a, b) => (a.reading || a.name).localeCompare(b.reading || b.name, 'ja'))
    } else if (sortMode === 'oldest' || sortMode === 'youngest') {
      const yearsOf = (p: Person) => resolveAge(toAgeSource(p), now).years
      list.sort((a, b) => {
        const ya = yearsOf(a), yb = yearsOf(b)
        // 年齢不明 (null) は常に末尾へ
        if (ya == null && yb == null) return 0
        if (ya == null) return 1
        if (yb == null) return -1
        return sortMode === 'oldest' ? yb - ya : ya - yb
      })
    }
    // 'recent' は created_at DESC のまま
    return list
  }, [people, query, activeTag, sortMode, now])

  // ────────────────────────────
  // モーダル操作
  // ────────────────────────────
  const openCreate = useCallback(() => {
    setModalError(null)
    setDraft(emptyDraft())
  }, [])

  const openEdit = useCallback((p: Person) => {
    setModalError(null)
    let ageMode: AgeMode = 'none'
    let birthDate = ''
    let approxAge = ''
    if (p.birth_year && p.birth_month && p.birth_day) {
      ageMode = 'exact'
      birthDate = `${p.birth_year}-${String(p.birth_month).padStart(2, '0')}-${String(p.birth_day).padStart(2, '0')}`
    } else if (p.approx_age != null) {
      ageMode = 'approx'
      // 編集時は「いま何歳くらいか」を見せる (基準日からの経過を加味した現在値)
      const r = resolveAge(toAgeSource(p), new Date())
      approxAge = String(r.years != null ? Math.round(r.years) : p.approx_age)
    }
    setDraft({
      id: p.id,
      name: p.name,
      nickname: p.nickname ?? '',
      reading: p.reading ?? '',
      relation: p.relation ?? '',
      ageMode, birthDate, approxAge,
      note: p.note ?? '',
      tags: [...p.tags],
      emoji: p.emoji,
      color: p.color_tag,
    })
  }, [])

  const closeModal = useCallback(() => {
    setDraft(null)
    setModalError(null)
  }, [])

  const saveDraft = useCallback(async () => {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) { setModalError('名前を入力してください'); return }

    // 年齢モードごとに DB カラムを組み立てる
    let birth_year: number | null = null
    let birth_month: number | null = null
    let birth_day: number | null = null
    let approx_age: number | null = null
    let approx_age_as_of: string | null = null

    if (draft.ageMode === 'exact') {
      if (!draft.birthDate) { setModalError('生年月日を入力してください'); return }
      const [y, m, d] = draft.birthDate.split('-').map(Number)
      if (!y || !m || !d) { setModalError('生年月日が正しくありません'); return }
      birth_year = y; birth_month = m; birth_day = d
    } else if (draft.ageMode === 'approx') {
      const a = parseInt(draft.approxAge, 10)
      if (isNaN(a) || a < 0 || a > 150) { setModalError('だいたいの年齢（0〜150）を入力してください'); return }
      approx_age = a
      approx_age_as_of = todayISO()
    }

    setSaving(true)
    setModalError(null)
    const payload = {
      user_id: userId,
      name,
      nickname: draft.nickname.trim() || null,
      reading: draft.reading.trim() || null,
      relation: draft.relation.trim() || null,
      birth_year, birth_month, birth_day,
      approx_age, approx_age_as_of,
      note: draft.note.trim() || null,
      tags: draft.tags,
      emoji: draft.emoji,
      color_tag: draft.color,
    }
    try {
      if (draft.id) {
        const { error } = await supabase
          .from('agey_people').update(payload)
          .eq('id', draft.id).eq('user_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('agey_people').insert(payload)
        if (error) throw error
      }
      await loadPeople(userId)
      closeModal()
    } catch (e: unknown) {
      setModalError('保存に失敗しました。時間をおいて再度お試しください')
      console.error('[agey] save failed', e)
    } finally {
      setSaving(false)
    }
  }, [draft, userId, loadPeople, closeModal])

  const deletePerson = useCallback(async (p: Person) => {
    if (!window.confirm(`「${p.name}」を削除しますか？`)) return
    const { error } = await supabase
      .from('agey_people').delete()
      .eq('id', p.id).eq('user_id', userId)
    if (error) { console.error('[agey] delete failed', error); return }
    setPeople(prev => prev.filter(x => x.id !== p.id))
  }, [userId])

  // ────────────────────────────
  // レンダリング
  // ────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100dvh', color: '#e0e0e0', paddingBottom: 100 }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(10,11,20,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(124,196,255,0.2)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/" aria-label="ホームに戻る" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', textDecoration: 'none', fontSize: 18,
        }}>←</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#7cc4ff', letterSpacing: 1, fontWeight: 700, textTransform: 'uppercase' }}>
            🌌 Filmo Universe
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
            👶 Filmo Agey
          </h1>
        </div>
      </header>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>読み込み中…</div>
      )}

      {!loading && authed === false && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ padding: '20px 20px 0', fontSize: 13, color: '#cfc6e0', lineHeight: 1.6 }}>
            名前・間柄・だいたいの年齢をメモして、いつでも引き出せるように。
            ログインするとデータが保存され、どの端末からでも見られます。
          </div>
          <LoginPrompt
            title="Filmo Agey を使う"
            subtitle="ログインすると、人物メモを保存・同期できます。"
            onAuthenticated={async (uid) => {
              setAuthed(true)
              setUserId(uid)
              setLoading(true)
              await loadPeople(uid)
              setLoading(false)
            }}
          />
        </div>
      )}

      {!loading && authed && (
        <>
          <section style={{ padding: '16px 20px 4px' }}>
            <div style={{ fontSize: 13, color: '#cfc6e0', lineHeight: 1.6 }}>
              名前や間柄、だいたいの年齢をメモ。生年月日を入れた人は、いまの正確な年齢（◯歳◯か月）が自動で更新されます。
            </div>
          </section>

          <section style={{ padding: '8px 16px 0' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="名前・あだ名・ふりがな・間柄・メモ・グループで検索"
              style={inputStyle}
            />
          </section>

          {allTags.length > 0 && (
            <section style={{ padding: '10px 16px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip active={activeTag === null} onClick={() => setActiveTag(null)}>すべて</Chip>
              {allTags.map(t => (
                <Chip key={t} active={activeTag === t} onClick={() => setActiveTag(activeTag === t ? null : t)}>
                  {t}
                </Chip>
              ))}
            </section>
          )}

          <section style={{ padding: '12px 16px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#888' }}>並び替え</span>
            {SORT_OPTIONS.map(o => (
              <button
                key={o.key}
                onClick={() => setSortMode(o.key)}
                style={{
                  padding: '5px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  border: '1px solid ' + (sortMode === o.key ? 'rgba(124,196,255,0.6)' : 'rgba(255,255,255,0.12)'),
                  background: sortMode === o.key ? 'rgba(124,196,255,0.18)' : 'rgba(255,255,255,0.04)',
                  color: sortMode === o.key ? '#cde8ff' : '#bbb', fontWeight: sortMode === o.key ? 700 : 500,
                }}>
                {o.label}
              </button>
            ))}
          </section>

          <section style={{ padding: '16px 16px 8px' }}>
            {people.length === 0 ? (
              <EmptyState onAdd={openCreate} />
            ) : visible.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#888', fontSize: 13 }}>
                該当する人が見つかりません。
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {visible.map(p => (
                  <PersonCard
                    key={p.id}
                    person={p}
                    now={now}
                    onEdit={() => openEdit(p)}
                    onDelete={() => deletePerson(p)}
                    onTagClick={(t) => setActiveTag(t)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {!loading && authed && (
        <button
          onClick={openCreate}
          aria-label="人を追加"
          style={{
            position: 'fixed', right: 20, bottom: 24, zIndex: 20,
            width: 56, height: 56, borderRadius: 28, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #7cc4ff, #a29bfe)', color: '#08111f',
            fontSize: 30, fontWeight: 800, lineHeight: 1,
            boxShadow: '0 8px 24px rgba(124,196,255,0.4)',
          }}>
          ＋
        </button>
      )}

      {draft && (
        <EditModal
          draft={draft}
          setDraft={setDraft}
          knownTags={allTags}
          saving={saving}
          error={modalError}
          onSave={saveDraft}
          onClose={closeModal}
        />
      )}
    </div>
  )
}

// ====================================================
// パーツ
// ====================================================
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box',
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
        border: '1px solid ' + (active ? 'rgba(124,196,255,0.6)' : 'rgba(255,255,255,0.14)'),
        background: active ? 'rgba(124,196,255,0.2)' : 'rgba(255,255,255,0.05)',
        color: active ? '#cde8ff' : '#cbb', fontWeight: active ? 700 : 500,
      }}>
      {children}
    </button>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      padding: '40px 24px', textAlign: 'center',
      border: '1px dashed rgba(124,196,255,0.3)', borderRadius: 16,
      background: 'rgba(124,196,255,0.04)',
    }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>👶</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        まだ誰も登録されていません
      </div>
      <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, marginBottom: 16 }}>
        名前・間柄・だいたいの年齢をメモしておけば、<br />「あの人だれだっけ？」を防げます。
      </div>
      <button
        onClick={onAdd}
        style={{
          padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #7cc4ff, #a29bfe)', color: '#08111f',
          fontSize: 14, fontWeight: 800,
        }}>
        ＋ 最初の一人を登録
      </button>
    </div>
  )
}

function PersonCard({
  person, now, onEdit, onDelete, onTagClick,
}: {
  person: Person
  now: Date
  onEdit: () => void
  onDelete: () => void
  onTagClick: (t: string) => void
}) {
  const age = resolveAge(toAgeSource(person), now)
  const accent = person.color_tag ?? '#7cc4ff'
  const showBirthday = age.kind === 'exact' && person.birth_month && person.birth_day
  const untilBirthday = showBirthday
    ? daysUntilNextBirthday(person.birth_month!, person.birth_day!, now)
    : null
  const ageColor = age.kind === 'none' ? '#777' : accent

  return (
    <div style={{
      padding: 16, borderRadius: 16,
      background: 'rgba(20,24,40,0.7)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: `4px solid ${accent}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          fontSize: 30, width: 48, height: 48, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 12, background: 'rgba(255,255,255,0.06)',
        }}>
          {person.emoji ?? '🙂'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {person.reading && (
            <div style={{ fontSize: 10, color: '#8aa', marginBottom: 1 }}>{person.reading}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', wordBreak: 'break-word' }}>
              {person.name}
            </span>
            {person.nickname && (
              <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>「{person.nickname}」</span>
            )}
            {person.relation && (
              <span style={{ fontSize: 11, color: '#9fb0c8' }}>{person.relation}</span>
            )}
          </div>
          <div style={{ fontSize: age.kind === 'none' ? 14 : 22, fontWeight: age.kind === 'none' ? 600 : 900, color: ageColor, marginTop: 2, letterSpacing: 0.3 }}>
            {age.label}
          </div>
          {showBirthday && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              {person.birth_year}/{String(person.birth_month).padStart(2, '0')}/{String(person.birth_day).padStart(2, '0')} 生まれ
              {untilBirthday === 0
                ? <span style={{ color: '#ffd24a', fontWeight: 700 }}>　🎂 今日は誕生日！</span>
                : <span>　🎂 あと{untilBirthday}日</span>}
            </div>
          )}
          {age.kind === 'approx' && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>生年月日は未登録（概算）</div>
          )}

          {person.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {person.tags.map(t => (
                <button
                  key={t}
                  onClick={() => onTagClick(t)}
                  style={{
                    padding: '2px 9px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                    background: 'rgba(124,196,255,0.12)', border: '1px solid rgba(124,196,255,0.3)',
                    color: '#cde8ff',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {person.note && (
            <div style={{
              fontSize: 12, color: '#bbb', marginTop: 8, lineHeight: 1.5,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {person.note}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button onClick={onEdit} aria-label="編集" style={iconBtnStyle}>✏️</button>
          <button onClick={onDelete} aria-label="削除" style={iconBtnStyle}>🗑️</button>
        </div>
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
}

// ====================================================
// 登録・編集モーダル
// ====================================================
function EditModal({
  draft, setDraft, knownTags, saving, error, onSave, onClose,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  knownTags: string[]
  saving: boolean
  error: string | null
  onSave: () => void
  onClose: () => void
}) {
  const [tagInput, setTagInput] = useState('')
  const today = useMemo(() => todayISO(), [])

  const addTag = useCallback((raw: string) => {
    const t = raw.trim()
    if (!t) return
    if (draft.tags.includes(t)) { setTagInput(''); return }
    setDraft({ ...draft, tags: [...draft.tags, t] })
    setTagInput('')
  }, [draft, setDraft])

  const removeTag = useCallback((t: string) => {
    setDraft({ ...draft, tags: draft.tags.filter(x => x !== t) })
  }, [draft, setDraft])

  const tagSuggestions = knownTags.filter(t => !draft.tags.includes(t)).slice(0, 8)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        minHeight: '100dvh',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          // テキスト入力を含むモーダル → iOS キーボード対策で dvh を使う
          maxHeight: '92dvh', overflowY: 'auto',
          background: '#12141f', borderRadius: '20px 20px 0 0',
          border: '1px solid rgba(124,196,255,0.25)', borderBottom: 'none',
          padding: '20px 20px 28px',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: 0 }}>
            {draft.id ? '編集' : '新しく登録'}
          </h2>
          <button onClick={onClose} aria-label="閉じる" style={{
            background: 'none', border: 'none', color: '#888', fontSize: 24, cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>

        {/* 名前 */}
        <label style={labelStyle}>名前 <span style={{ color: '#ff6b6b' }}>*</span></label>
        <input
          value={draft.name}
          onChange={e => setDraft({ ...draft, name: e.target.value })}
          placeholder="例: 田中 たろう"
          maxLength={60}
          style={inputStyle}
        />

        {/* ニックネーム */}
        <label style={{ ...labelStyle, marginTop: 14 }}>ニックネーム・あだ名</label>
        <input
          value={draft.nickname}
          onChange={e => setDraft({ ...draft, nickname: e.target.value })}
          placeholder="例: ゆうくん"
          maxLength={60}
          style={inputStyle}
        />

        {/* ふりがな */}
        <label style={{ ...labelStyle, marginTop: 14 }}>ふりがな・読み</label>
        <input
          value={draft.reading}
          onChange={e => setDraft({ ...draft, reading: e.target.value })}
          placeholder="例: たなか たろう"
          maxLength={60}
          style={inputStyle}
        />

        {/* 間柄 */}
        <label style={{ ...labelStyle, marginTop: 14 }}>間柄・つながり</label>
        <input
          value={draft.relation}
          onChange={e => setDraft({ ...draft, relation: e.target.value })}
          placeholder="例: さくらの友達 / 会社の同期 / ◯◯の弟"
          maxLength={60}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {RELATION_PRESETS.map(r => (
            <button key={r} onClick={() => setDraft({ ...draft, relation: r })} style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#aaa',
            }}>{r}</button>
          ))}
        </div>

        {/* 年齢モード */}
        <label style={{ ...labelStyle, marginTop: 16 }}>年齢</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {([
            ['exact', '誕生日がわかる'],
            ['approx', 'だいたいの年齢'],
            ['none', '不明'],
          ] as [AgeMode, string][]).map(([m, lbl]) => (
            <button
              key={m}
              onClick={() => setDraft({ ...draft, ageMode: m })}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 9, fontSize: 12, cursor: 'pointer',
                border: '1px solid ' + (draft.ageMode === m ? 'rgba(124,196,255,0.6)' : 'rgba(255,255,255,0.12)'),
                background: draft.ageMode === m ? 'rgba(124,196,255,0.18)' : 'rgba(255,255,255,0.04)',
                color: draft.ageMode === m ? '#cde8ff' : '#bbb', fontWeight: draft.ageMode === m ? 700 : 500,
              }}>
              {lbl}
            </button>
          ))}
        </div>

        {draft.ageMode === 'exact' && (
          <input
            type="date"
            value={draft.birthDate}
            max={today}
            onChange={e => setDraft({ ...draft, birthDate: e.target.value })}
            style={{ ...inputStyle, colorScheme: 'dark' }}
          />
        )}
        {draft.ageMode === 'approx' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: '#cfc6e0' }}>だいたい</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={150}
              value={draft.approxAge}
              onChange={e => setDraft({ ...draft, approxAge: e.target.value })}
              placeholder="5"
              style={{ ...inputStyle, width: 90, textAlign: 'center' }}
            />
            <span style={{ fontSize: 14, color: '#cfc6e0' }}>歳くらい</span>
          </div>
        )}
        {draft.ageMode === 'approx' && (
          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
            ※ 今日を基準に記録し、来年以降は自動で「約◯歳」が繰り上がります。
          </div>
        )}
        {draft.ageMode === 'none' && (
          <div style={{ fontSize: 12, color: '#888' }}>
            年齢は登録せず、名前と間柄・メモだけ残します。
          </div>
        )}

        {/* グループタグ */}
        <label style={{ ...labelStyle, marginTop: 16 }}>グループ（保育園・クラス・部活・会社など）</label>
        {draft.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {draft.tags.map(t => (
              <span key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 6px 4px 10px', borderRadius: 999, fontSize: 12,
                background: 'rgba(124,196,255,0.15)', border: '1px solid rgba(124,196,255,0.35)', color: '#cde8ff',
              }}>
                {t}
                <button onClick={() => removeTag(t)} aria-label="削除" style={{
                  background: 'none', border: 'none', color: '#cde8ff', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
                }}>×</button>
              </span>
            ))}
          </div>
        )}
        <input
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
          }}
          placeholder="入力して Enter で追加（例: さくら組）"
          style={inputStyle}
        />
        {tagSuggestions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {tagSuggestions.map(t => (
              <button key={t} onClick={() => addTag(t)} style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#aaa',
              }}>+ {t}</button>
            ))}
          </div>
        )}

        {/* メモ */}
        <label style={{ ...labelStyle, marginTop: 16 }}>メモ（親の名前・特徴・どこで会ったか等）</label>
        <textarea
          value={draft.note}
          onChange={e => setDraft({ ...draft, note: e.target.value })}
          placeholder="自由に記入"
          maxLength={1000}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />

        {/* アイコン */}
        <label style={{ ...labelStyle, marginTop: 16 }}>アイコン</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EMOJI_PRESETS.map(em => (
            <button
              key={em}
              onClick={() => setDraft({ ...draft, emoji: draft.emoji === em ? null : em })}
              style={{
                width: 40, height: 40, borderRadius: 10, fontSize: 20, cursor: 'pointer',
                background: draft.emoji === em ? 'rgba(124,196,255,0.22)' : 'rgba(255,255,255,0.05)',
                border: '1px solid ' + (draft.emoji === em ? 'rgba(124,196,255,0.6)' : 'rgba(255,255,255,0.12)'),
              }}>
              {em}
            </button>
          ))}
        </div>

        {/* カラー */}
        <label style={{ ...labelStyle, marginTop: 16 }}>カードの色</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLOR_PRESETS.map(c => (
            <button
              key={c}
              onClick={() => setDraft({ ...draft, color: draft.color === c ? null : c })}
              aria-label={`色 ${c}`}
              style={{
                width: 32, height: 32, borderRadius: 999, cursor: 'pointer', background: c,
                border: draft.color === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>

        {error && (
          <div style={{
            marginTop: 16, padding: '10px 12px', borderRadius: 8, fontSize: 13,
            background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.35)', color: '#ffb3b3',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} disabled={saving} style={{
            flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#ccc',
          }}>
            キャンセル
          </button>
          <button onClick={onSave} disabled={saving} style={{
            flex: 2, padding: '12px', borderRadius: 10, cursor: saving ? 'default' : 'pointer', fontSize: 14, fontWeight: 800,
            background: saving ? 'rgba(124,196,255,0.4)' : 'linear-gradient(135deg, #7cc4ff, #a29bfe)',
            border: 'none', color: '#08111f',
          }}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: '#9fb0c8', marginBottom: 6,
}
