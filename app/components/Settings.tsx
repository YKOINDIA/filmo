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

  // ── プロフィール属性 (任意、レコメンドに使用) ──
  const [gender, setGender] = useState<string>('')
  const [birthYear, setBirthYear] = useState<string>('')
  const [birthMonth, setBirthMonth] = useState<string>('')
  const [birthDay, setBirthDay] = useState<string>('')
  const [country, setCountry] = useState<string>('')
  const [hometown, setHometown] = useState<string>('')
  const [currentLocation, setCurrentLocation] = useState<string>('')
  const [showProfile, setShowProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [isProfilePublic, setIsProfilePublic] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const { data } = await supabase.from('users')
      .select('email, notify_new_release, notify_streaming, notify_follow, notify_like, notify_community, notify_email, gender, birth_year, birth_month, birth_day, country, hometown, current_location, is_profile_public')
      .eq('id', userId).single()
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
      setGender(data.gender || '')
      setBirthYear(data.birth_year ? String(data.birth_year) : '')
      setBirthMonth(data.birth_month ? String(data.birth_month) : '')
      setBirthDay(data.birth_day ? String(data.birth_day) : '')
      setCountry(data.country || '')
      setHometown(data.hometown || '')
      setCurrentLocation(data.current_location || '')
      setIsProfilePublic(data.is_profile_public ?? true)
    }
  }

  const updateProfileVisibility = async (value: boolean) => {
    setIsProfilePublic(value)
    const { error } = await supabase.from('users').update({ is_profile_public: value }).eq('id', userId)
    if (error) {
      showToast('保存に失敗しました')
      setIsProfilePublic(!value)
    } else {
      showToast(value ? 'プロフィールを公開にしました' : 'プロフィールを非公開にしました')
    }
  }

  const saveProfileAttrs = async () => {
    setSavingProfile(true)
    try {
      const updates: Record<string, unknown> = {
        gender: gender || null,
        birth_year: birthYear ? parseInt(birthYear, 10) : null,
        birth_month: birthMonth ? parseInt(birthMonth, 10) : null,
        birth_day: birthDay ? parseInt(birthDay, 10) : null,
        country: country || null,
        hometown: hometown.trim() || null,
        current_location: currentLocation.trim() || null,
      }
      const { error } = await supabase.from('users').update(updates).eq('id', userId)
      if (error) {
        showToast('保存に失敗しました')
      } else {
        showToast('プロフィールを更新しました')
      }
    } finally {
      setSavingProfile(false)
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

      {/* プライバシー */}
      <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', fontWeight: 600, marginBottom: 8, marginLeft: 4 }}>プライバシー</div>
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: '4px 16px', border: '1px solid var(--fm-border)', marginBottom: 16 }}>
        <SettingRow label="プロフィールを公開" desc={isProfilePublic ? '他のユーザーがあなたのプロフィールを閲覧できます' : '/u/[id] からは「非公開」と表示されます'}>
          <ToggleSwitch checked={isProfilePublic} onChange={updateProfileVisibility} />
        </SettingRow>
      </div>

      {/* アカウント */}
      <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', fontWeight: 600, marginBottom: 8, marginLeft: 4 }}>アカウント</div>
      <div style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--fm-border)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>メールアドレス</div>
        <div style={{ fontSize: 15, marginTop: 4 }}>{email}</div>
      </div>

      {/* プロフィール属性 (任意・レコメンドに使用、公開はされない) */}
      <button onClick={() => setShowProfile(v => !v)}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--fm-border)',
          background: 'var(--fm-bg-card)', color: 'var(--fm-text)', cursor: 'pointer',
          fontSize: 14, fontWeight: 600, textAlign: 'left', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
        <span>👤 プロフィール属性 <span style={{ fontSize: 11, color: 'var(--fm-text-sub)', marginLeft: 6 }}>(任意・非公開)</span></span>
        <span style={{ color: 'var(--fm-text-sub)' }}>{showProfile ? '▲' : '▼'}</span>
      </button>

      {showProfile && (
        <div className="animate-fade-in" style={{ background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 16, lineHeight: 1.5 }}>
            ここで入力した情報は<strong>レコメンドのみに使用</strong>され、他のユーザーには表示されません。
          </div>

          {/* 性別 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6, fontWeight: 600 }}>性別</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {[
                { v: 'female', l: '女性' },
                { v: 'male', l: '男性' },
                { v: 'other', l: 'その他' },
                { v: 'prefer_not_to_say', l: '無回答' },
              ].map(opt => {
                const sel = gender === opt.v
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setGender(sel ? '' : opt.v)}
                    style={{
                      padding: '10px 4px', borderRadius: 8,
                      border: `1px solid ${sel ? 'var(--fm-accent)' : 'var(--fm-border)'}`,
                      background: sel ? 'rgba(108,92,231,0.18)' : 'var(--fm-bg-input)',
                      color: sel ? 'var(--fm-accent)' : 'var(--fm-text-sub)',
                      fontSize: 12, fontWeight: sel ? 700 : 500, cursor: 'pointer',
                    }}
                  >
                    {opt.l}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 生年月日 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6, fontWeight: 600 }}>生年月日</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
              <select value={birthYear} onChange={e => setBirthYear(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14 }}>
                <option value="">年</option>
                {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
              <select value={birthMonth} onChange={e => setBirthMonth(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14 }}>
                <option value="">月</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
              <select value={birthDay} onChange={e => setBirthDay(e.target.value)}
                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14 }}>
                <option value="">日</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}日</option>
                ))}
              </select>
            </div>
          </div>

          {/* 国 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6, fontWeight: 600 }}>国</div>
            <select value={country} onChange={e => setCountry(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14 }}>
              <option value="">未選択</option>
              <option value="JP">🇯🇵 日本</option>
              <option value="US">🇺🇸 アメリカ</option>
              <option value="KR">🇰🇷 韓国</option>
              <option value="CN">🇨🇳 中国</option>
              <option value="TW">🇹🇼 台湾</option>
              <option value="HK">🇭🇰 香港</option>
              <option value="GB">🇬🇧 イギリス</option>
              <option value="FR">🇫🇷 フランス</option>
              <option value="DE">🇩🇪 ドイツ</option>
              <option value="IT">🇮🇹 イタリア</option>
              <option value="ES">🇪🇸 スペイン</option>
              <option value="CA">🇨🇦 カナダ</option>
              <option value="AU">🇦🇺 オーストラリア</option>
              <option value="BR">🇧🇷 ブラジル</option>
              <option value="IN">🇮🇳 インド</option>
              <option value="MX">🇲🇽 メキシコ</option>
              <option value="TH">🇹🇭 タイ</option>
              <option value="VN">🇻🇳 ベトナム</option>
              <option value="ID">🇮🇩 インドネシア</option>
              <option value="PH">🇵🇭 フィリピン</option>
            </select>
          </div>

          {/* 出身地 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6, fontWeight: 600 }}>出身地</div>
            <input
              type="text"
              value={hometown}
              onChange={e => setHometown(e.target.value)}
              placeholder="例: 東京都 / 大阪府 / Seoul"
              maxLength={50}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          {/* 住んでいる場所 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6, fontWeight: 600 }}>住んでいる場所</div>
            <input
              type="text"
              value={currentLocation}
              onChange={e => setCurrentLocation(e.target.value)}
              placeholder="例: 東京都 / 横浜市 / Tokyo"
              maxLength={50}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={saveProfileAttrs}
            disabled={savingProfile}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
              background: 'var(--fm-accent)', color: '#fff', fontWeight: 600,
              cursor: savingProfile ? 'not-allowed' : 'pointer',
              opacity: savingProfile ? 0.6 : 1,
            }}
          >
            {savingProfile ? '保存中…' : '保存'}
          </button>
        </div>
      )}

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
                if (deletingAccount) return
                setDeletingAccount(true)
                try {
                  const { data: { session } } = await supabase.auth.getSession()
                  if (!session) {
                    showToast('ログインが必要です')
                    setDeletingAccount(false)
                    return
                  }
                  const res = await fetch('/api/account/delete', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  })
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.error || 'アカウント削除に失敗しました')
                  }
                  await supabase.auth.signOut()
                  showToast('アカウントを削除しました')
                  window.location.reload()
                } catch (err) {
                  console.error('Account delete failed:', err)
                  showToast(err instanceof Error ? err.message : 'アカウント削除に失敗しました')
                  setDeletingAccount(false)
                }
              }}
                disabled={deletingAccount}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
                  background: 'var(--fm-danger)', color: '#fff',
                  cursor: deletingAccount ? 'wait' : 'pointer', fontWeight: 600,
                  opacity: deletingAccount ? 0.6 : 1,
                }}>
                {deletingAccount ? '削除中…' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
