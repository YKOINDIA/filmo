'use client'

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../lib/toast'

export type ReportTargetType = 'review' | 'list' | 'user'

interface ReportModalProps {
  targetType: ReportTargetType
  targetId: string
  /** 通報先の表示用ラベル (例: 「@taro さんのレビュー」) */
  targetLabel?: string
  onClose: () => void
}

const REASONS: { value: string; label: string; description: string }[] = [
  { value: 'spam', label: 'スパム / 宣伝', description: '無関係な広告や繰り返し投稿' },
  { value: 'harassment', label: '嫌がらせ・誹謗中傷', description: '個人攻撃や差別的表現' },
  { value: 'inappropriate', label: '不適切なコンテンツ', description: '暴力・性的・違法な内容' },
  { value: 'copyright', label: '著作権侵害', description: '無断転載・盗用' },
  { value: 'other', label: 'その他', description: '上記に当てはまらない問題' },
]

const TARGET_LABEL: Record<ReportTargetType, string> = {
  review: 'このレビュー',
  list: 'このリスト',
  user: 'このユーザー',
}

export default function ReportModal({ targetType, targetId, targetLabel, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<string>('')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!reason) {
      showToast('通報理由を選択してください')
      return
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        showToast('ログインが必要です')
        return
      }
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetType, targetId, reason, detail: detail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || '送信に失敗しました')
        return
      }
      if (data.alreadyReported) {
        showToast('既に通報済みです。24時間以内に確認します')
      } else {
        showToast('通報を受け付けました。24時間以内に確認します')
      }
      onClose()
    } catch {
      showToast('送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }, [reason, detail, targetType, targetId, onClose])

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <button onClick={onClose} style={s.closeBtn} aria-label="閉じる">×</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fm-text)' }}>
            通報する
          </span>
          <div style={{ width: 40 }} />
        </div>

        <div style={s.body}>
          <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 16, lineHeight: 1.6 }}>
            {targetLabel || TARGET_LABEL[targetType]}を運営に通報します。<br />
            通報内容は運営のみが確認し、24時間以内に対応します。
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>通報理由 *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REASONS.map(r => (
                <label key={r.value} style={{
                  ...s.reasonRow,
                  borderColor: reason === r.value ? 'var(--fm-accent)' : 'var(--fm-border)',
                  background: reason === r.value ? 'rgba(108,92,231,0.08)' : 'var(--fm-bg-input)',
                }}>
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fm-text)' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 2 }}>{r.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>詳細(任意・1000文字まで)</label>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value.slice(0, 1000))}
              placeholder="補足情報があればご記入ください"
              style={s.textarea}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !reason}
            style={{
              ...s.primaryBtn,
              width: '100%',
              opacity: submitting || !reason ? 0.5 : 1,
              cursor: submitting || !reason ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? '送信中...' : '通報を送信する'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed' as const, inset: 0, zIndex: 2200,
    background: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    padding: 16, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'var(--fm-bg)', borderRadius: 16,
    width: '100%', maxWidth: 440, maxHeight: '85dvh',
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
  body: { padding: 16, overflowY: 'auto' as const, flex: 1 },
  formGroup: { marginBottom: 16 },
  label: {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--fm-text-sub)', marginBottom: 6,
  },
  reasonRow: {
    display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--fm-border)',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  textarea: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
    color: 'var(--fm-text)', fontSize: 14, minHeight: 80,
    resize: 'vertical' as const, boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '12px 20px', borderRadius: 10, border: 'none',
    background: 'var(--fm-accent)', color: '#fff',
    fontSize: 14, fontWeight: 600, minHeight: 44,
  },
}
