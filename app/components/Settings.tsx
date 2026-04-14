'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/useTheme'
import { showToast } from '../lib/toast'
import { useLocale } from '../lib/i18n'
import LanguageSelector from './LanguageSelector'

export default function Settings({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { theme, toggle } = useTheme()
  const { t } = useLocale()
  const [notifySettings, setNotifySettings] = useState({
    notify_new_release: true,
    notify_streaming: true,
    notify_follow: true,
    notify_like: true,
    notify_community: true,
    notify_email: false,
  })
  const [email, setEmail] = useState('')
  const [feedbackCategory, setFeedbackCategory] = useState('feature')
  const [feedbackSubject, setFeedbackSubject] = useState('')
  const [feedbackBody, setFeedbackBody] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const { data } = await supabase.from('users').select('email, notify_new_release, notify_streaming, notify_follow, notify_like, notify_community, notify_email').eq('id', userId).single()
    if (data) {
      setEmail(data.email)
      setNotifySettings({
        notify_new_release: data.notify_new_release,
        notify_streaming: data.notify_streaming,
        notify_follow: data.notify_follow,
        notify_like: data.notify_like,
        notify_community: data.notify_community,
        notify_email: data.notify_email,
      })
    }
  }

  const updateNotify = async (key: string, value: boolean) => {
    setNotifySettings(prev => ({ ...prev, [key]: value }))
    const { error } = await supabase.from('users').update({ [key]: value }).eq('id', userId)
    if (error) console.error('Notify update failed:', error)
  }

  const submitFeedback = async () => {
    if (!feedbackSubject.trim()) return
    const { data, error: threadErr } = await supabase.from('feedback_threads').insert({
      user_id: userId,
      category: feedbackCategory,
      subject: feedbackSubject,
    }).select('id').single()

    if (threadErr) { showToast('送信に失敗しました'); return }

    if (data && feedbackBody.trim()) {
      const { error: msgErr } = await supabase.from('feedback_messages').insert({
        thread_id: data.id,
        body: feedbackBody,
        is_admin: false,
      })
      if (msgErr) console.error('Feedback message failed:', msgErr)
    }
    showToast('フィードバックを送信しました')
    setShowFeedback(false)
    setFeedbackSubject('')
    setFeedbackBody('')
  }

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!checked)}
      style={{
        width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--fm-accent)' : 'var(--fm-border)',
        position: 'relative', transition: 'background 0.2s',
      }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        transition: 'left 0.2s',
      }} />
    </button>
  )

  const SettingRow = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: '1px solid var(--fm-border)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  )

  return (
    <div style={{ padding: 16 }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--fm-text)', cursor: 'pointer', fontSize: 20 }}>←</button>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>{t('profile.settings')}</h2>
      </div>

      {/* 言語 */}
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
        <LanguageSelector />
      </div>

      {/* テーマ */}
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: '4px 16px', border: '1px solid var(--fm-border)', marginBottom: 16 }}>
        <SettingRow label={t('settings.theme')} desc={theme === 'dark' ? t('settings.dark') : t('settings.light')}>
          <ToggleSwitch checked={theme === 'dark'} onChange={toggle} />
        </SettingRow>
      </div>

      {/* 通知設定 */}
      <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', fontWeight: 600, marginBottom: 8, marginLeft: 4 }}>{t('settings.notifications')}</div>
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: '4px 16px', border: '1px solid var(--fm-border)', marginBottom: 16 }}>
        <SettingRow label="新作公開通知" desc="Fan!登録した人物の新作">
          <ToggleSwitch checked={notifySettings.notify_new_release} onChange={v => updateNotify('notify_new_release', v)} />
        </SettingRow>
        <SettingRow label="配信開始通知" desc="Watchlist作品の配信開始">
          <ToggleSwitch checked={notifySettings.notify_streaming} onChange={v => updateNotify('notify_streaming', v)} />
        </SettingRow>
        <SettingRow label="フォロー通知" desc="新しいフォロワー">
          <ToggleSwitch checked={notifySettings.notify_follow} onChange={v => updateNotify('notify_follow', v)} />
        </SettingRow>
        <SettingRow label="いいね通知" desc="レビューへのいいね">
          <ToggleSwitch checked={notifySettings.notify_like} onChange={v => updateNotify('notify_like', v)} />
        </SettingRow>
        <SettingRow label="コミュニティ通知" desc="フォロー中ユーザーの活動">
          <ToggleSwitch checked={notifySettings.notify_community} onChange={v => updateNotify('notify_community', v)} />
        </SettingRow>
        <SettingRow label="メール通知">
          <ToggleSwitch checked={notifySettings.notify_email} onChange={v => updateNotify('notify_email', v)} />
        </SettingRow>
      </div>

      {/* アカウント */}
      <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', fontWeight: 600, marginBottom: 8, marginLeft: 4 }}>アカウント</div>
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--fm-border)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>メールアドレス</div>
        <div style={{ fontSize: 15, marginTop: 4 }}>{email}</div>
      </div>

      {/* フィードバック */}
      <button onClick={() => setShowFeedback(!showFeedback)}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--fm-border)',
          background: 'var(--fm-bg-card)', color: 'var(--fm-text)', cursor: 'pointer',
          fontSize: 14, fontWeight: 600, textAlign: 'left', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
        <span>📝 フィードバック・ご要望</span>
        <span style={{ color: 'var(--fm-text-sub)' }}>{showFeedback ? '▲' : '▼'}</span>
      </button>

      {showFeedback && (
        <div className="animate-fade-in" style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
          <select value={feedbackCategory} onChange={e => setFeedbackCategory(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, marginBottom: 12 }}>
            <option value="feature">機能要望</option>
            <option value="bug">不具合報告</option>
            <option value="question">質問</option>
            <option value="other">その他</option>
          </select>
          <input value={feedbackSubject} onChange={e => setFeedbackSubject(e.target.value)} placeholder="件名"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }} />
          <textarea value={feedbackBody} onChange={e => setFeedbackBody(e.target.value)} placeholder="詳細（任意）" rows={4}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }} />
          <button onClick={submitFeedback}
            style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--fm-accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            送信
          </button>
        </div>
      )}

      {/* リーガル */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <a href="/legal" style={{ color: 'var(--fm-text-sub)', fontSize: 13 }}>利用規約</a>
        <a href="/legal" style={{ color: 'var(--fm-text-sub)', fontSize: 13 }}>プライバシーポリシー</a>
      </div>

      {/* 危険ゾーン */}
      <div style={{ borderTop: '1px solid var(--fm-border)', paddingTop: 16 }}>
        <button onClick={() => setShowDeleteConfirm(true)}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: '1px solid var(--fm-danger)',
            background: 'transparent', color: 'var(--fm-danger)', cursor: 'pointer',
            fontSize: 14, fontWeight: 600,
          }}>
          アカウントを削除
        </button>
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--fm-bg-card)', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>アカウント削除</h3>
            <p style={{ color: 'var(--fm-text-sub)', fontSize: 14, marginBottom: 24 }}>
              この操作は取り消せません。すべてのデータが削除されます。
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-card)', color: 'var(--fm-text)', cursor: 'pointer', fontWeight: 600 }}>
                キャンセル
              </button>
              <button onClick={async () => {
                await supabase.from('users').delete().eq('id', userId)
                await supabase.auth.signOut()
                window.location.reload()
              }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--fm-danger)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
