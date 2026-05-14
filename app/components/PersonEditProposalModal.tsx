'use client'

/**
 * 人物編集提案モーダル。
 *
 * /people/[id] および PersonDetail モーダルから起動。
 * 名前・別名・経歴・生年月日・出身地・公式サイトを編集提案できる。
 * profile_path や known_for は TMDB 再キャッシュで上書きされるため対象外。
 *
 * 1 提案 = 複数フィールドの変更まとめ (proposed_data.changes 配列)。
 */
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'
import { POINT_CONFIG } from '../lib/points'
import { trackPersonEditProposed } from '../lib/analytics'

interface Props {
  personId: number
  /** 現在値 (TMDB or DB) */
  current: {
    name?: string | null
    original_name?: string | null
    biography?: string | null
    birthday?: string | null
    place_of_birth?: string | null
    homepage?: string | null
  }
  onClose: () => void
  onSubmitted?: () => void
}

interface ChangeRow {
  field_name: string
  current_value: string | null
  proposed_value: string
}

const FIELDS: { key: 'name' | 'original_name' | 'biography' | 'birthday' | 'place_of_birth' | 'homepage'; label: string; multiline?: boolean; type?: string; placeholder?: string }[] = [
  { key: 'name', label: '名前', placeholder: '泉原航一' },
  { key: 'original_name', label: '別名・原語表記', placeholder: 'Koichi Izuhara' },
  { key: 'birthday', label: '生年月日', type: 'date' },
  { key: 'place_of_birth', label: '出身地', placeholder: '大阪府岸和田市' },
  { key: 'homepage', label: '公式サイト', type: 'url', placeholder: 'https://...' },
  { key: 'biography', label: '経歴・説明', multiline: true, placeholder: '経歴・代表作・受賞歴など' },
]

export default function PersonEditProposalModal({ personId, current, onClose, onSubmitted }: Props) {
  // 各フィールドの提案値。空文字 = 未編集
  const [draft, setDraft] = useState<Record<string, string>>(() => ({
    name: current.name || '',
    original_name: current.original_name || '',
    biography: current.biography || '',
    birthday: current.birthday || '',
    place_of_birth: current.place_of_birth || '',
    homepage: current.homepage || '',
  }))
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 変更点の検出
  const changes: ChangeRow[] = FIELDS
    .map(f => {
      const orig = (current[f.key] || '').toString().trim()
      const next = (draft[f.key] || '').trim()
      if (next === orig) return null
      if (next === '' && !orig) return null
      return {
        field_name: f.key,
        current_value: orig || null,
        proposed_value: next,
      } as ChangeRow
    })
    .filter((c): c is ChangeRow => c !== null)

  const handleSubmit = useCallback(async () => {
    if (changes.length === 0) {
      showToast('変更がありません')
      return
    }
    setSubmitting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) {
        showToast('ログインが必要です')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/edit-proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'person_submit',
          personId,
          changes,
          reason: reason.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || '送信に失敗しました')
        setSubmitting(false)
        return
      }
      trackPersonEditProposed(personId, changes.length)
      showToast('編集提案を送信しました。管理者の承認をお待ちください。')
      onSubmitted?.()
      onClose()
    } catch {
      showToast('送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }, [personId, changes, reason, onClose, onSubmitted])

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <button onClick={onClose} style={s.closeBtn} aria-label="閉じる">×</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)' }}>編集を提案</span>
          <div style={{ width: 40 }} />
        </div>

        <div style={s.body}>
          <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 14, lineHeight: 1.6 }}>
            変更したいフィールドの値を編集してください。<br />
            管理者の承認後に反映されます。承認されると +{POINT_CONFIG.EDIT_PROPOSAL_APPROVED}pt。
          </div>

          {FIELDS.map(f => {
            const value = draft[f.key] || ''
            const original = (current[f.key] || '').toString()
            const changed = value.trim() !== original.trim() && (value.trim() !== '' || original.trim() !== '')
            return (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={s.label}>
                  {f.label}
                  {changed && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--fm-accent)', fontWeight: 600 }}>
                      変更あり
                    </span>
                  )}
                </label>
                {original && (
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginBottom: 4 }}>
                    現在: {original.length > 100 ? original.slice(0, 100) + '…' : original}
                  </div>
                )}
                {f.multiline ? (
                  <textarea
                    value={value}
                    onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    maxLength={3000}
                    rows={4}
                    style={s.textarea}
                  />
                ) : (
                  <input
                    type={f.type || 'text'}
                    value={value}
                    onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    maxLength={f.key === 'place_of_birth' ? 200 : 100}
                    style={s.input}
                  />
                )}
              </div>
            )
          })}

          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>修正理由（任意）</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="ソース URL / 補足説明など"
              maxLength={1000}
              rows={2}
              style={s.textarea}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>
              {changes.length === 0 ? '変更点なし' : `${changes.length} 件の変更`}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || changes.length === 0}
              style={{ ...s.primaryBtn, opacity: submitting || changes.length === 0 ? 0.5 : 1 }}
            >
              {submitting ? '送信中…' : '提案を送信'}
            </button>
          </div>
        </div>
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
  label: {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--fm-text-sub)', marginBottom: 4,
  },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
    color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' as const,
    minHeight: 40, fontFamily: 'inherit',
  },
  textarea: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
    color: 'var(--fm-text)', fontSize: 14, minHeight: 70,
    resize: 'vertical' as const, boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '10px 20px', borderRadius: 10, border: 'none',
    background: 'var(--fm-accent)', color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44,
  },
}
