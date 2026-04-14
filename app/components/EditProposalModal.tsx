'use client'

import { useState, useCallback } from 'react'
import { showToast } from '../lib/toast'

interface EditProposalModalProps {
  userId: string
  movieId: number
  fieldName: string
  fieldLabel: string
  currentValue: string
  onClose: () => void
  onSubmitted: () => void
}

export default function EditProposalModal({
  userId, movieId, fieldName, fieldLabel, currentValue, onClose, onSubmitted,
}: EditProposalModalProps) {
  const [proposedValue, setProposedValue] = useState(currentValue)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!proposedValue.trim() || proposedValue === currentValue) {
      showToast('変更内容を入力してください')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/edit-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          userId,
          movieId,
          fieldName,
          currentValue,
          proposedValue: proposedValue.trim(),
          reason: reason.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast(data.error || '送信に失敗しました')
        return
      }
      showToast('修正提案を送信しました。管理者が確認します。')
      onSubmitted()
      onClose()
    } catch {
      showToast('送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }, [userId, movieId, fieldName, currentValue, proposedValue, reason, onClose, onSubmitted])

  const isTextArea = fieldName === 'overview'

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <button onClick={onClose} style={s.closeBtn}>×</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)' }}>
            修正を提案
          </span>
          <div style={{ width: 40 }} />
        </div>

        <div style={s.body}>
          <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 16 }}>
            「{fieldLabel}」の修正を提案します。管理者が確認後、承認されると反映されます。
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>現在の値</label>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--fm-bg-hover)', fontSize: 14, color: 'var(--fm-text-muted)', minHeight: 44, wordBreak: 'break-word' }}>
              {currentValue || '（未設定）'}
            </div>
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>提案する値 *</label>
            {isTextArea ? (
              <textarea
                value={proposedValue}
                onChange={e => setProposedValue(e.target.value)}
                placeholder="修正後の内容..."
                style={s.textarea}
              />
            ) : (
              <input
                type="text"
                value={proposedValue}
                onChange={e => setProposedValue(e.target.value)}
                placeholder="修正後の値"
                style={s.input}
              />
            )}
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>修正理由（任意）</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="例: タイトルの表記が間違っている"
              style={s.input}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !proposedValue.trim() || proposedValue === currentValue}
            style={{
              ...s.primaryBtn,
              width: '100%',
              marginTop: 8,
              opacity: submitting || !proposedValue.trim() || proposedValue === currentValue ? 0.5 : 1,
            }}
          >
            {submitting ? '送信中...' : '修正を提案する'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 2100,
    background: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    padding: 16, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'var(--fm-bg)', borderRadius: 16,
    width: '100%', maxWidth: 440, maxHeight: '80dvh',
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
  formGroup: { marginBottom: 16 },
  label: {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--fm-text-sub)', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
    color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' as const,
    minHeight: 44,
  },
  textarea: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
    color: 'var(--fm-text)', fontSize: 14, minHeight: 100,
    resize: 'vertical' as const, boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '12px 20px', borderRadius: 10, border: 'none',
    background: 'var(--fm-accent)', color: '#fff',
    fontSize: 14, fontWeight: 600, cursor: 'pointer', minHeight: 44,
  },
}
