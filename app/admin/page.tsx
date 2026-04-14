'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'ykoindia@gmail.com'

type Tab = 'kpi' | 'users' | 'reviews' | 'segments' | 'community' | 'security' | 'xpost' | 'coupons' | 'announce' | 'cron' | 'feedback' | 'work_requests' | 'edit_proposals'

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('kpi')

  // KPI state
  const [kpi, setKpi] = useState({ totalUsers: 0, newUsersToday: 0, totalReviews: 0, totalWatches: 0, avgLevel: 0 })

  // Users state
  const [users, setUsers] = useState<Record<string, unknown>[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'banned'>('all')

  // Reviews state
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([])

  // Security state
  const [alerts, setAlerts] = useState<Record<string, unknown>[]>([])

  // X Posts state
  const [drafts, setDrafts] = useState<Record<string, unknown>[]>([])
  const [draftText, setDraftText] = useState('')

  // Coupons state
  const [coupons, setCoupons] = useState<Record<string, unknown>[]>([])
  const [couponCode, setCouponCode] = useState('')
  const [couponDesc, setCouponDesc] = useState('')
  const [couponPoints, setCouponPoints] = useState(100)
  const [couponMaxUses, setCouponMaxUses] = useState(100)

  // Announcements state
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [announceType, setAnnounceType] = useState('info')
  const [announcements, setAnnouncements] = useState<Record<string, unknown>[]>([])

  // Cron state
  const [cronSettings, setCronSettings] = useState<Record<string, unknown>[]>([])

  // Feedback state
  const [feedbackThreads, setFeedbackThreads] = useState<Record<string, unknown>[]>([])
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<Record<string, unknown>[]>([])
  const [replyText, setReplyText] = useState('')

  // Work requests state
  const [workRequests, setWorkRequests] = useState<Record<string, unknown>[]>([])
  const [workReqFilter, setWorkReqFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')

  // Edit proposals state
  const [editProposals, setEditProposals] = useState<Record<string, unknown>[]>([])
  const [editPropFilter, setEditPropFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')

  useEffect(() => {
    checkAdmin()
  }, [])

  useEffect(() => {
    if (isAdmin) loadTabData()
  }, [tab, isAdmin])

  const checkAdmin = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user?.email === ADMIN_EMAIL) {
        setIsAdmin(true)
      }
    } catch { /* not logged in */ }
    setLoading(false)
  }

  const loadTabData = async () => {
    switch (tab) {
      case 'kpi': await loadKPI(); break
      case 'users': await loadUsers(); break
      case 'reviews': await loadReviews(); break
      case 'security': await loadAlerts(); break
      case 'xpost': await loadDrafts(); break
      case 'coupons': await loadCoupons(); break
      case 'announce': await loadAnnouncements(); break
      case 'cron': await loadCronSettings(); break
      case 'feedback': await loadFeedback(); break
      case 'work_requests': await loadWorkRequests(); break
      case 'edit_proposals': await loadEditProposals(); break
    }
  }

  const loadKPI = async () => {
    try {
      const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true })
      const { count: totalReviews } = await supabase.from('reviews').select('*', { count: 'exact', head: true })
      const { count: totalWatches } = await supabase.from('watchlists').select('*', { count: 'exact', head: true })

      const today = new Date().toISOString().split('T')[0]
      const { count: newUsersToday } = await supabase.from('users').select('*', { count: 'exact', head: true })
        .gt('created_at', `${today}T00:00:00.000Z`)

      setKpi({
        totalUsers: totalUsers ?? 0,
        newUsersToday: newUsersToday ?? 0,
        totalReviews: totalReviews ?? 0,
        totalWatches: totalWatches ?? 0,
        avgLevel: 1,
      })
    } catch { /* ignore */ }
  }

  const loadUsers = async () => {
    try {
      let query = supabase.from('users').select('*').order('created_at', { ascending: false }).limit(50)
      if (userFilter === 'banned') query = query.eq('is_banned', true)
      const { data } = await query
      setUsers(data ?? [])
    } catch { /* ignore */ }
  }

  const loadReviews = async () => {
    try {
      const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(50)
      setReviews(data ?? [])
    } catch { /* ignore */ }
  }

  const loadAlerts = async () => {
    try {
      const { data } = await supabase.from('admin_alerts').select('*').order('created_at', { ascending: false }).limit(50)
      setAlerts(data ?? [])
    } catch { /* ignore */ }
  }

  const loadDrafts = async () => {
    try {
      const { data } = await supabase.from('x_post_drafts').select('*').order('created_at', { ascending: false }).limit(50)
      setDrafts(data ?? [])
    } catch { /* ignore */ }
  }

  const loadCoupons = async () => {
    try {
      const { data } = await supabase.from('campaign_coupons').select('*').order('created_at', { ascending: false }).limit(50)
      setCoupons(data ?? [])
    } catch { /* ignore */ }
  }

  const loadAnnouncements = async () => {
    try {
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(50)
      setAnnouncements(data ?? [])
    } catch { /* ignore */ }
  }

  const loadCronSettings = async () => {
    try {
      const { data } = await supabase.from('cron_settings').select('*').limit(20)
      setCronSettings(data ?? [])
    } catch { /* ignore */ }
  }

  const loadFeedback = async () => {
    try {
      const { data } = await supabase.from('feedback_threads').select('*').order('created_at', { ascending: false }).limit(50)
      setFeedbackThreads(data ?? [])
    } catch { /* ignore */ }
  }

  const loadWorkRequests = async () => {
    try {
      const res = await fetch(`/api/edit-proposals?action=work_requests&status=${workReqFilter}`)
      const data = await res.json()
      setWorkRequests(data.requests || [])
    } catch { /* ignore */ }
  }

  const loadEditProposals = async () => {
    try {
      const res = await fetch(`/api/edit-proposals?action=list&status=${editPropFilter}`)
      const data = await res.json()
      setEditProposals(data.proposals || [])
    } catch { /* ignore */ }
  }

  const handleWorkRequest = async (requestId: string, approve: boolean) => {
    const { data: session } = await supabase.auth.getSession()
    const adminId = session.session?.user?.id
    await fetch('/api/edit-proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: approve ? 'approve_request' : 'reject_request',
        requestId,
        adminId,
      }),
    })
    loadWorkRequests()
  }

  const handleEditProposal = async (proposalId: string, approve: boolean) => {
    const { data: session } = await supabase.auth.getSession()
    const adminId = session.session?.user?.id
    await fetch('/api/edit-proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: approve ? 'approve' : 'reject',
        proposalId,
        adminId,
      }),
    })
    loadEditProposals()
  }

  const toggleBan = async (userId: string, isBanned: boolean) => {
    await supabase.from('users').update({ is_banned: !isBanned }).eq('id', userId)
    loadUsers()
  }

  const hideReview = async (reviewId: string, isHidden: boolean) => {
    await supabase.from('reviews').update({ is_hidden: !isHidden }).eq('id', reviewId)
    loadReviews()
  }

  const createDraft = async () => {
    if (!draftText.trim()) return
    await supabase.from('x_post_drafts').insert({
      text: draftText,
      status: 'draft',
    })
    setDraftText('')
    loadDrafts()
  }

  const deleteDraft = async (id: string) => {
    await supabase.from('x_post_drafts').delete().eq('id', id)
    loadDrafts()
  }

  const createCoupon = async () => {
    if (!couponCode.trim()) return
    await supabase.from('campaign_coupons').insert({
      code: couponCode,
      description: couponDesc,
      bonus_points: couponPoints,
      max_uses: couponMaxUses,
      current_uses: 0,
    })
    setCouponCode('')
    setCouponDesc('')
    loadCoupons()
  }

  const sendAnnouncement = async () => {
    if (!announceTitle.trim()) return
    const { data } = await supabase.auth.getSession()
    await fetch('/api/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: announceTitle,
        body: announceBody,
        type: announceType,
        admin_email: data.session?.user?.email,
      }),
    })
    setAnnounceTitle('')
    setAnnounceBody('')
    loadAnnouncements()
  }

  const toggleCron = async (id: string, enabled: boolean) => {
    await supabase.from('cron_settings').update({ enabled: !enabled }).eq('id', id)
    loadCronSettings()
  }

  const loadThreadMessages = async (threadId: string) => {
    setSelectedThread(threadId)
    const { data } = await supabase.from('feedback_messages').select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(100)
    setThreadMessages(data ?? [])
  }

  const sendReply = async () => {
    if (!replyText.trim() || !selectedThread) return
    await supabase.from('feedback_messages').insert({
      thread_id: selectedThread,
      body: replyText,
      is_admin: true,
    })
    await supabase.from('feedback_threads').update({
      unread_user: true,
      unread_admin: false,
      status: 'in_progress',
    }).eq('id', selectedThread)
    setReplyText('')
    loadThreadMessages(selectedThread)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fm-text-sub)' }}>Loading...</div>
  if (!isAdmin) return <div style={{ padding: 40, textAlign: 'center' }}><h2>アクセス権限がありません</h2><p style={{ color: 'var(--fm-text-sub)' }}>管理者としてログインしてください</p></div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'kpi', label: 'KPI' },
    { key: 'users', label: 'ユーザー' },
    { key: 'reviews', label: 'レビュー' },
    { key: 'segments', label: 'セグメント' },
    { key: 'community', label: 'コミュニティ' },
    { key: 'security', label: 'セキュリティ' },
    { key: 'xpost', label: 'X投稿' },
    { key: 'coupons', label: 'クーポン' },
    { key: 'announce', label: 'お知らせ' },
    { key: 'cron', label: 'Cron' },
    { key: 'feedback', label: 'フィードバック' },
    { key: 'work_requests', label: '作品リクエスト' },
    { key: 'edit_proposals', label: '修正提案' },
  ]

  const S = {
    card: { background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16, border: '1px solid var(--fm-border)', marginBottom: 12 } as React.CSSProperties,
    input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 14, boxSizing: 'border-box' as const, marginBottom: 8 } as React.CSSProperties,
    btn: { padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--fm-accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 } as React.CSSProperties,
    btnDanger: { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--fm-danger)', background: 'transparent', color: 'var(--fm-danger)', cursor: 'pointer', fontSize: 12 } as React.CSSProperties,
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>🎬 Filmo 管理画面</h1>

      {/* タブ */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid var(--fm-border)',
              background: tab === t.key ? 'var(--fm-accent)' : 'var(--fm-bg-card)',
              color: tab === t.key ? '#fff' : 'var(--fm-text-sub)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI */}
      {tab === 'kpi' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: '総ユーザー', value: kpi.totalUsers, icon: '👥' },
              { label: '本日の新規', value: kpi.newUsersToday, icon: '🆕' },
              { label: '総レビュー', value: kpi.totalReviews, icon: '✍️' },
              { label: '総鑑賞記録', value: kpi.totalWatches, icon: '🎬' },
            ].map((m, i) => (
              <div key={i} style={S.card}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{m.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fm-accent)' }}>{m.value.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ユーザー */}
      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="名前/メールで検索" style={{ ...S.input, marginBottom: 0, flex: 1 }} />
            <select value={userFilter} onChange={e => { setUserFilter(e.target.value as typeof userFilter); setTimeout(loadUsers, 100) }}
              style={{ ...S.input, marginBottom: 0, width: 'auto' }}>
              <option value="all">全て</option>
              <option value="active">アクティブ</option>
              <option value="banned">BAN</option>
            </select>
          </div>
          {users.filter(u => !userSearch || (u.name as string)?.includes(userSearch) || (u.email as string)?.includes(userSearch)).map(u => (
            <div key={u.id as string} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--fm-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{String(u.name || '')} {u.is_banned ? <span style={{ color: 'var(--fm-danger)', fontSize: 11 }}>[BAN]</span> : null}</div>
                <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>{u.email as string}</div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>Lv.{u.level as number} / {u.points as number}pt / 連続{u.login_streak as number}日</div>
              </div>
              <button onClick={() => toggleBan(u.id as string, u.is_banned as boolean)} style={u.is_banned ? S.btn : S.btnDanger}>
                {u.is_banned ? 'BAN解除' : 'BAN'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* レビュー */}
      {tab === 'reviews' && (
        <div>
          {reviews.map(r => (
            <div key={r.id as string} style={{ ...S.card, opacity: r.is_hidden ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>★{r.score as number} - Movie ID: {r.movie_id as number}</span>
                <button onClick={() => hideReview(r.id as string, r.is_hidden as boolean)} style={S.btnDanger}>
                  {r.is_hidden ? '表示' : '非表示'}
                </button>
              </div>
              <div style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>{(r.body as string)?.substring(0, 200)}</div>
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 4 }}>
                User: {r.user_id as string} / {new Date(r.created_at as string).toLocaleDateString('ja-JP')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* セグメント */}
      {tab === 'segments' && (
        <div style={S.card}>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>ユーザーセグメント</h3>
          <p style={{ color: 'var(--fm-text-sub)', fontSize: 13 }}>
            セグメント分析はKPIデータから自動計算されます。ユーザー数が増えると詳細なセグメントが表示されます。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            {['パワーユーザー (50+レビュー)', '新規ユーザー (7日以内)', '非アクティブ (30日未ログイン)', '高エンゲージメント (100+鑑賞)'].map((seg, i) => (
              <div key={i} style={{ padding: 12, background: 'var(--fm-bg-secondary)', borderRadius: 8, fontSize: 13 }}>{seg}</div>
            ))}
          </div>
        </div>
      )}

      {/* コミュニティ */}
      {tab === 'community' && (
        <div style={S.card}>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>コミュニティ統計</h3>
          <p style={{ color: 'var(--fm-text-sub)', fontSize: 13 }}>フォローネットワーク、最多フォロワー、最多いいねレビューなどを表示します。</p>
        </div>
      )}

      {/* セキュリティ */}
      {tab === 'security' && (
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>管理者アラート</h3>
          {alerts.length === 0 ? (
            <div style={S.card}><span style={{ color: 'var(--fm-text-sub)' }}>アラートはありません</span></div>
          ) : alerts.map(a => (
            <div key={a.id as string} style={{
              ...S.card,
              borderLeft: `3px solid ${(a.severity as string) === 'critical' ? 'var(--fm-danger)' : (a.severity as string) === 'warning' ? 'var(--fm-warning)' : 'var(--fm-accent)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{a.type as string}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: (a.severity as string) === 'critical' ? 'var(--fm-danger)' : (a.severity as string) === 'warning' ? 'var(--fm-warning)' : 'var(--fm-accent)',
                  color: '#fff',
                }}>
                  {a.severity as string}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginTop: 4 }}>{JSON.stringify(a.detail)}</div>
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 4 }}>{new Date(a.created_at as string).toLocaleString('ja-JP')}</div>
            </div>
          ))}
        </div>
      )}

      {/* X投稿 */}
      {tab === 'xpost' && (
        <div>
          <div style={S.card}>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>新規下書き</h3>
            <textarea value={draftText} onChange={e => setDraftText(e.target.value)} rows={3} placeholder="ポストのテキスト..." style={{ ...S.input, resize: 'vertical' }} />
            <button onClick={createDraft} style={S.btn}>下書き保存</button>
          </div>
          {drafts.map(d => (
            <div key={d.id as string} style={S.card}>
              <div style={{ fontSize: 13, marginBottom: 8 }}>{d.text as string}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: (d.status as string) === 'posted' ? 'var(--fm-success)' : 'var(--fm-warning)',
                  color: '#fff',
                }}>
                  {(d.status as string) === 'posted' ? '投稿済み' : '下書き'}
                </span>
                <button onClick={() => deleteDraft(d.id as string)} style={S.btnDanger}>削除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* クーポン */}
      {tab === 'coupons' && (
        <div>
          <div style={S.card}>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>新規クーポン</h3>
            <input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="クーポンコード" style={S.input} />
            <input value={couponDesc} onChange={e => setCouponDesc(e.target.value)} placeholder="説明" style={S.input} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input type="number" value={couponPoints} onChange={e => setCouponPoints(Number(e.target.value))} style={{ ...S.input, marginBottom: 0 }} placeholder="ポイント" />
              <input type="number" value={couponMaxUses} onChange={e => setCouponMaxUses(Number(e.target.value))} style={{ ...S.input, marginBottom: 0 }} placeholder="最大利用回数" />
            </div>
            <button onClick={createCoupon} style={S.btn}>作成</button>
          </div>
          {coupons.map(c => (
            <div key={c.id as string} style={S.card}>
              <div style={{ fontWeight: 600 }}>{c.code as string}</div>
              <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>{c.description as string}</div>
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                {c.bonus_points as number}pt / 利用: {c.current_uses as number}/{c.max_uses as number}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* お知らせ */}
      {tab === 'announce' && (
        <div>
          <div style={S.card}>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>お知らせ送信</h3>
            <input value={announceTitle} onChange={e => setAnnounceTitle(e.target.value)} placeholder="タイトル" style={S.input} />
            <textarea value={announceBody} onChange={e => setAnnounceBody(e.target.value)} rows={3} placeholder="本文" style={{ ...S.input, resize: 'vertical' }} />
            <select value={announceType} onChange={e => setAnnounceType(e.target.value)} style={{ ...S.input, width: 'auto' }}>
              <option value="info">情報</option>
              <option value="warning">注意</option>
              <option value="important">重要</option>
            </select>
            <button onClick={sendAnnouncement} style={S.btn}>全ユーザーに送信</button>
          </div>
          {announcements.map(a => (
            <div key={a.id as string} style={S.card}>
              <div style={{ fontWeight: 600 }}>{a.title as string}</div>
              <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginTop: 4 }}>{a.body as string}</div>
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginTop: 4 }}>
                送信数: {a.recipient_count as number} / {new Date(a.created_at as string).toLocaleDateString('ja-JP')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cron */}
      {tab === 'cron' && (
        <div>
          {cronSettings.map(c => (
            <div key={c.id as string} style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.path as string}</div>
                <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>
                  最終実行: {c.last_run ? new Date(c.last_run as string).toLocaleString('ja-JP') : '未実行'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>ステータス: {(c.last_status as string) || '-'}</div>
              </div>
              <button onClick={() => toggleCron(c.id as string, c.enabled as boolean)}
                style={{
                  ...S.btn,
                  background: c.enabled ? 'var(--fm-success)' : 'var(--fm-text-muted)',
                }}>
                {c.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 作品リクエスト */}
      {tab === 'work_requests' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => { setWorkReqFilter(f); setTimeout(loadWorkRequests, 100) }}
                style={{
                  ...S.btn,
                  background: workReqFilter === f ? 'var(--fm-accent)' : 'var(--fm-bg-card)',
                  color: workReqFilter === f ? '#fff' : 'var(--fm-text-sub)',
                  border: '1px solid var(--fm-border)',
                }}>
                {f === 'pending' ? '未処理' : f === 'approved' ? '承認済' : '却下'}
              </button>
            ))}
          </div>
          {workRequests.length === 0 ? (
            <div style={S.card}><span style={{ color: 'var(--fm-text-sub)' }}>リクエストはありません</span></div>
          ) : workRequests.map(r => (
            <div key={r.id as string} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.title as string}</div>
                  {r.original_title ? <div style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>{String(r.original_title)}</div> : null}
                </div>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                  background: r.media_type === 'movie' ? 'var(--fm-accent)' : r.media_type === 'anime' ? '#e91e63' : 'var(--fm-success)',
                  color: '#fff',
                }}>
                  {r.media_type === 'movie' ? '映画' : r.media_type === 'anime' ? 'アニメ' : 'ドラマ'}
                </span>
              </div>
              {r.description ? <div style={{ fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 8 }}>{String(r.description)}</div> : null}
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginBottom: 8 }}>
                {r.year ? `${r.year}年 / ` : ''}User: {String(r.user_id).slice(0, 8)}... / {new Date(r.created_at as string).toLocaleDateString('ja-JP')}
              </div>
              {workReqFilter === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleWorkRequest(r.id as string, true)} style={S.btn}>承認（作品作成）</button>
                  <button onClick={() => handleWorkRequest(r.id as string, false)} style={S.btnDanger}>却下</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 修正提案 */}
      {tab === 'edit_proposals' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => { setEditPropFilter(f); setTimeout(loadEditProposals, 100) }}
                style={{
                  ...S.btn,
                  background: editPropFilter === f ? 'var(--fm-accent)' : 'var(--fm-bg-card)',
                  color: editPropFilter === f ? '#fff' : 'var(--fm-text-sub)',
                  border: '1px solid var(--fm-border)',
                }}>
                {f === 'pending' ? '未処理' : f === 'approved' ? '承認済' : '却下'}
              </button>
            ))}
          </div>
          {editProposals.length === 0 ? (
            <div style={S.card}><span style={{ color: 'var(--fm-text-sub)' }}>提案はありません</span></div>
          ) : editProposals.map(p => (
            <div key={p.id as string} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>Movie ID: {p.movie_id as number} / {p.field_name as string}</span>
                <span style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
                  {new Date(p.created_at as string).toLocaleDateString('ja-JP')}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ padding: 8, borderRadius: 6, background: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.15)', fontSize: 13 }}>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginBottom: 4 }}>現在の値</div>
                  <div style={{ wordBreak: 'break-word' }}>{(p.current_value as string) || '（未設定）'}</div>
                </div>
                <div style={{ padding: 8, borderRadius: 6, background: 'rgba(0,255,0,0.05)', border: '1px solid rgba(0,255,0,0.15)', fontSize: 13 }}>
                  <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginBottom: 4 }}>提案する値</div>
                  <div style={{ wordBreak: 'break-word' }}>{p.proposed_value as string}</div>
                </div>
              </div>
              {p.reason ? <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 8 }}>理由: {String(p.reason)}</div> : null}
              <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginBottom: 8 }}>
                User: {(p.user_id as string).slice(0, 8)}...
              </div>
              {editPropFilter === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleEditProposal(p.id as string, true)} style={S.btn}>承認（反映）</button>
                  <button onClick={() => handleEditProposal(p.id as string, false)} style={S.btnDanger}>却下</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* フィードバック */}
      {tab === 'feedback' && (
        <div>
          {!selectedThread ? (
            feedbackThreads.map(t => (
              <div key={t.id as string} onClick={() => loadThreadMessages(t.id as string)}
                style={{ ...S.card, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{t.subject as string}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: (t.status as string) === 'resolved' ? 'var(--fm-success)' : (t.status as string) === 'in_progress' ? 'var(--fm-warning)' : 'var(--fm-accent)',
                    color: '#fff',
                  }}>
                    {t.status as string}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fm-text-sub)', marginTop: 4 }}>
                  {t.category as string} / {new Date(t.created_at as string).toLocaleDateString('ja-JP')}
                  {t.unread_admin ? <span style={{ color: 'var(--fm-danger)', marginLeft: 8 }}>● 未読</span> : null}
                </div>
              </div>
            ))
          ) : (
            <div>
              <button onClick={() => setSelectedThread(null)} style={{ ...S.btn, marginBottom: 12, background: 'var(--fm-bg-card)', color: 'var(--fm-text)', border: '1px solid var(--fm-border)' }}>
                ← 一覧に戻る
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {threadMessages.map(m => (
                  <div key={m.id as string} style={{
                    ...S.card,
                    marginLeft: m.is_admin ? 40 : 0,
                    marginRight: m.is_admin ? 0 : 40,
                    background: m.is_admin ? 'rgba(108,92,231,0.1)' : 'var(--fm-bg-card)',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginBottom: 4 }}>
                      {m.is_admin ? '管理者' : 'ユーザー'} / {new Date(m.created_at as string).toLocaleString('ja-JP')}
                    </div>
                    <div style={{ fontSize: 14 }}>{m.body as string}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="返信..." rows={2}
                  style={{ ...S.input, marginBottom: 0, flex: 1 }} />
                <button onClick={sendReply} style={S.btn}>送信</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
