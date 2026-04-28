'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'ykoindia@gmail.com'

type Tab = 'kpi' | 'users' | 'reviews' | 'segments' | 'fraud' | 'community' | 'security' | 'xpost' | 'coupons' | 'announce' | 'cron' | 'feedback' | 'work_requests' | 'edit_proposals'

interface KpiData {
  totals: { users: number; reviews: number; watches: number; lists: number; comments: number }
  today: { newUsers: number; newReviews: number; newWatches: number }
  activeUsers: { dau: number; wau: number; mau: number }
  funnel: { signup: number; firstWatched: number; firstReview: number }
  retention: Record<string, { cohort: number; retained: number; rate: number }>
  timeseries: {
    signups: { date: string; count: number }[]
    reviews: { date: string; count: number }[]
    watches: { date: string; count: number }[]
  }
}

interface SegmentBreakdown {
  total: number
  byCountry: { breakdown: { key: string; count: number; pct: number }[]; unknown: number; total: number }
  byGender: { breakdown: { key: string; count: number; pct: number }[]; unknown: number; total: number }
  byBirthDecade: { breakdown: { key: string; count: number; pct: number }[]; unknown: number; total: number }
  byLevel: { breakdown: { key: string; count: number; pct: number }[]; unknown: number; total: number }
  bySignupCohort: { breakdown: { key: string; count: number; pct: number }[]; unknown: number; total: number }
}

interface FraudData {
  massLikers: { userId: string; name: string; email: string; counts: number[] }[]
  massCommenters: { userId: string; name: string; email: string; counts: number[] }[]
  massFollowers: { userId: string; name: string; email: string; counts: number[] }[]
  suspiciousReviews: { userId: string; name: string; email: string; counts: number[] }[]
  recentBans: { id: string; email: string; name: string; ban_reason: string; updated_at: string }[]
  generatedAt: string
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('kpi')

  // KPI state (新 API ベース)
  const [kpi, setKpi] = useState<KpiData | null>(null)
  const [kpiLoading, setKpiLoading] = useState(false)
  // segments
  const [segments, setSegments] = useState<SegmentBreakdown | null>(null)
  const [segmentsLoading, setSegmentsLoading] = useState(false)
  // fraud
  const [fraud, setFraud] = useState<FraudData | null>(null)
  const [fraudLoading, setFraudLoading] = useState(false)

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
      case 'segments': await loadSegments(); break
      case 'fraud': await loadFraud(); break
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
    setKpiLoading(true)
    try {
      const res = await fetch(`/api/admin/kpi?email=${encodeURIComponent(ADMIN_EMAIL)}`)
      if (!res.ok) throw new Error(`KPI ${res.status}`)
      const data = await res.json() as KpiData
      setKpi(data)
    } catch (err) {
      console.error('KPI load failed:', err)
    } finally {
      setKpiLoading(false)
    }
  }

  const loadSegments = async () => {
    setSegmentsLoading(true)
    try {
      const res = await fetch(`/api/admin/segments?email=${encodeURIComponent(ADMIN_EMAIL)}`)
      if (!res.ok) throw new Error(`segments ${res.status}`)
      const data = await res.json() as SegmentBreakdown
      setSegments(data)
    } catch (err) {
      console.error('Segments load failed:', err)
    } finally {
      setSegmentsLoading(false)
    }
  }

  const loadFraud = async () => {
    setFraudLoading(true)
    try {
      const res = await fetch(`/api/admin/fraud?email=${encodeURIComponent(ADMIN_EMAIL)}`)
      if (!res.ok) throw new Error(`fraud ${res.status}`)
      const data = await res.json() as FraudData
      setFraud(data)
    } catch (err) {
      console.error('Fraud load failed:', err)
    } finally {
      setFraudLoading(false)
    }
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

  const tabs: { key: Tab; label: string; group: '分析' | '管理' | '運用' }[] = [
    // 分析
    { key: 'kpi', label: '📊 KPI', group: '分析' },
    { key: 'segments', label: '🧩 セグメント', group: '分析' },
    // 管理 (ユーザー / コンテンツ / 不正)
    { key: 'users', label: '👥 ユーザー', group: '管理' },
    { key: 'reviews', label: '✍️ レビュー', group: '管理' },
    { key: 'community', label: '💬 コミュニティ', group: '管理' },
    { key: 'fraud', label: '🚨 不正監視', group: '管理' },
    { key: 'security', label: '🔒 セキュリティ', group: '管理' },
    // 運用
    { key: 'announce', label: '📣 お知らせ', group: '運用' },
    { key: 'xpost', label: '𝕏 投稿', group: '運用' },
    { key: 'coupons', label: '🎟 クーポン', group: '運用' },
    { key: 'cron', label: '⏱ Cron', group: '運用' },
    { key: 'feedback', label: '📝 フィードバック', group: '運用' },
    { key: 'work_requests', label: '🎬 作品リクエスト', group: '運用' },
    { key: 'edit_proposals', label: '🛠 修正提案', group: '運用' },
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
          {kpiLoading && <div style={{ padding: 20, color: 'var(--fm-text-sub)' }}>集計中…</div>}
          {kpi && (
            <>
              {/* Top metrics */}
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fm-text-sub)', marginBottom: 8 }}>📈 アクティブユーザー</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'DAU (24h)', value: kpi.activeUsers.dau, icon: '🟢' },
                  { label: 'WAU (7d)', value: kpi.activeUsers.wau, icon: '🟡' },
                  { label: 'MAU (30d)', value: kpi.activeUsers.mau, icon: '🔵' },
                ].map((m, i) => (
                  <div key={i} style={S.card}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fm-accent)' }}>{m.value.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fm-text-sub)', marginBottom: 8 }}>📦 累計</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: '総ユーザー', value: kpi.totals.users },
                  { label: 'レビュー', value: kpi.totals.reviews },
                  { label: '鑑賞記録', value: kpi.totals.watches },
                  { label: 'リスト', value: kpi.totals.lists },
                  { label: 'コメント', value: kpi.totals.comments },
                ].map((m, i) => (
                  <div key={i} style={{ ...S.card, marginBottom: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fm-text)' }}>{m.value.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Today */}
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fm-text-sub)', marginBottom: 8 }}>📅 本日</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: '新規ユーザー', value: kpi.today.newUsers, icon: '🆕' },
                  { label: '新規レビュー', value: kpi.today.newReviews, icon: '✍️' },
                  { label: '新規鑑賞', value: kpi.today.newWatches, icon: '🎬' },
                ].map((m, i) => (
                  <div key={i} style={{ ...S.card, marginBottom: 0 }}>
                    <div style={{ fontSize: 16 }}>{m.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fm-accent)' }}>+{m.value.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* 30-day timeseries (sparkline) */}
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fm-text-sub)', marginBottom: 8 }}>📈 30日トレンド</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 20 }}>
                <Sparkline title="新規登録" data={kpi.timeseries.signups} color="#a29bfe" />
                <Sparkline title="レビュー" data={kpi.timeseries.reviews} color="#2ecc8a" />
                <Sparkline title="鑑賞記録" data={kpi.timeseries.watches} color="#f39c12" />
              </div>

              {/* Funnel */}
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fm-text-sub)', marginBottom: 8 }}>🔥 コンバージョンファネル</div>
              <div style={{ ...S.card, marginBottom: 20 }}>
                {(() => {
                  const total = kpi.funnel.signup || 1
                  const steps = [
                    { label: '登録', value: kpi.funnel.signup },
                    { label: '初鑑賞', value: kpi.funnel.firstWatched },
                    { label: '初レビュー', value: kpi.funnel.firstReview },
                  ]
                  return steps.map((s, i) => {
                    const pct = (s.value / total) * 100
                    return (
                      <div key={s.label} style={{ marginBottom: i < steps.length - 1 ? 10 : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fm-text-sub)', marginBottom: 4 }}>
                          <span>{s.label}</span>
                          <span><strong style={{ color: 'var(--fm-text)' }}>{s.value.toLocaleString()}</strong> ({pct.toFixed(1)}%)</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--fm-bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--fm-accent)' }} />
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>

              {/* Retention */}
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fm-text-sub)', marginBottom: 8 }}>🔁 リテンション (登録N日後にアクティブ)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {(['d1', 'd7', 'd30'] as const).map(k => {
                  const r = kpi.retention[k]
                  if (!r) return null
                  const ratePct = (r.rate * 100).toFixed(1)
                  return (
                    <div key={k} style={{ ...S.card, marginBottom: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--fm-text-sub)' }}>{k.toUpperCase()}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--fm-accent)' }}>{ratePct}%</div>
                      <div style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>{r.retained}/{r.cohort} 名</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
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
        <div>
          {segmentsLoading && <div style={{ padding: 20, color: 'var(--fm-text-sub)' }}>集計中…</div>}
          {segments && (
            <>
              <div style={{ ...S.card, marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--fm-text-sub)' }}>分析対象ユーザー</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--fm-accent)', marginLeft: 12 }}>{segments.total.toLocaleString()}名</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <SegmentBreakdownCard title="🌍 国" data={segments.byCountry} />
                <SegmentBreakdownCard title="👤 性別" data={segments.byGender} labelMap={{ male: '男性', female: '女性', other: 'その他', prefer_not_to_say: '無回答' }} />
                <SegmentBreakdownCard title="🎂 生年代" data={segments.byBirthDecade} />
                <SegmentBreakdownCard title="🏆 レベル" data={segments.byLevel} />
                <SegmentBreakdownCard title="📅 登録月" data={segments.bySignupCohort} />
              </div>
            </>
          )}
        </div>
      )}

      {/* 不正監視 */}
      {tab === 'fraud' && (
        <div>
          {fraudLoading && <div style={{ padding: 20, color: 'var(--fm-text-sub)' }}>分析中…</div>}
          {fraud && (
            <>
              <div style={{ fontSize: 12, color: 'var(--fm-text-muted)', marginBottom: 12 }}>
                過去24時間の活動から異常を検出 (生成: {new Date(fraud.generatedAt).toLocaleString('ja-JP')})
              </div>
              <FraudList title="❤️ 大量いいね (24h で50件以上)" rows={fraud.massLikers} unit="件" />
              <FraudList title="💬 大量コメント (24h で30件以上)" rows={fraud.massCommenters} unit="件" />
              <FraudList title="👥 大量フォロー (24h で50件以上)" rows={fraud.massFollowers} unit="件" />
              <FraudList title="✍️ 短文レビュー連投 (10件以上 & 平均20字未満)" rows={fraud.suspiciousReviews} unit="件" suffix="(平均字数)" />
              <div style={{ ...S.card, marginTop: 20 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>🚫 直近のBAN</h3>
                {fraud.recentBans.length === 0 ? (
                  <div style={{ color: 'var(--fm-text-muted)', fontSize: 13 }}>BANしたユーザーはいません</div>
                ) : (
                  fraud.recentBans.map(u => (
                    <div key={u.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--fm-border)', fontSize: 13 }}>
                      <strong>{u.name || '?'}</strong> ({u.email}) — <span style={{ color: 'var(--fm-text-sub)' }}>{u.ban_reason}</span>
                      <span style={{ float: 'right', color: 'var(--fm-text-muted)', fontSize: 11 }}>
                        {new Date(u.updated_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
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

// セグメント breakdown カード
function SegmentBreakdownCard({ title, data, labelMap }: {
  title: string
  data: { breakdown: { key: string; count: number; pct: number }[]; unknown: number; total: number }
  labelMap?: Record<string, string>
}) {
  const items = data.breakdown.slice(0, 12)
  return (
    <div style={{
      background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16,
      border: '1px solid var(--fm-border)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fm-text)', marginBottom: 10 }}>
        {title}
        {data.unknown > 0 && (
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--fm-text-muted)', marginLeft: 8 }}>
            (未入力 {data.unknown})
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>データなし</div>
      ) : items.map(it => {
        const pct = (it.pct * 100).toFixed(1)
        return (
          <div key={it.key} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
              <span style={{ color: 'var(--fm-text)' }}>{labelMap?.[it.key] || it.key}</span>
              <span style={{ color: 'var(--fm-text-sub)' }}>
                {it.count.toLocaleString()} ({pct}%)
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--fm-bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--fm-accent)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 不正検知リスト
function FraudList({ title, rows, unit, suffix }: {
  title: string
  rows: { userId: string; name: string; email: string; counts: number[] }[]
  unit: string
  suffix?: string
}) {
  return (
    <div style={{
      background: 'var(--fm-bg-card)', borderRadius: 12, padding: 16,
      border: '1px solid var(--fm-border)', marginBottom: 12,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</h3>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--fm-text-muted)' }}>該当ユーザーはいません</div>
      ) : (
        rows.map(r => (
          <div key={r.userId} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
            borderBottom: '1px solid var(--fm-border)', fontSize: 13,
          }}>
            <a href={`/u/${r.userId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fm-text)', textDecoration: 'none' }}>
              <strong>{r.name || '?'}</strong>
            </a>
            <span style={{ color: 'var(--fm-text-sub)', fontSize: 12 }}>{r.email}</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--fm-danger)' }}>
              {r.counts[0]} {unit}
              {r.counts.length > 1 && suffix && (
                <span style={{ fontSize: 11, color: 'var(--fm-text-muted)', marginLeft: 6 }}>
                  {suffix.replace('(', '').replace(')', '')}: {r.counts[1]}
                </span>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

// 30日 sparkline (SVG, ライブラリなし)
function Sparkline({ title, data, color }: {
  title: string
  data: { date: string; count: number }[]
  color: string
}) {
  if (data.length === 0) return null
  const W = 600, H = 60, P = 4
  const max = Math.max(...data.map(d => d.count), 1)
  const total = data.reduce((s, d) => s + d.count, 0)
  const stepX = (W - 2 * P) / Math.max(data.length - 1, 1)

  const points = data.map((d, i) => {
    const x = P + i * stepX
    const y = H - P - (d.count / max) * (H - 2 * P)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  // 棒グラフ風の塗り (面積)
  const area = `M ${P},${H - P} L ${points} L ${P + (data.length - 1) * stepX},${H - P} Z`

  return (
    <div style={{
      background: 'var(--fm-bg-card)', borderRadius: 12, padding: 12,
      border: '1px solid var(--fm-border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fm-text)' }}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--fm-text-sub)' }}>
          30日合計 <strong style={{ color: 'var(--fm-text)' }}>{total.toLocaleString()}</strong>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
        <path d={area} fill={color} fillOpacity={0.18} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fm-text-muted)', marginTop: 4 }}>
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}
