'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { checkLoginStreak } from './lib/points'
import Dashboard from './components/Dashboard'
import Search from './components/Search'
import WorkDetail from './components/WorkDetail'
import Profile from './components/Profile'
import Feed from './components/Feed'
import Statistics from './components/Statistics'
import Settings from './components/Settings'
import Gamification from './components/Gamification'
import NotificationBell from './components/NotificationBell'
import Toast from './components/Toast'
import Onboarding from './components/Onboarding'
import ShareCard from './components/ShareCard'
import { MIN_RATINGS_FOR_MATCH } from './lib/matchScore'

type Tab = 'home' | 'search' | 'feed' | 'stats' | 'profile'

interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  bio: string
  favorite_genres: string[]
  level: number
  points: number
  login_streak: number
  best_movie_title: string | null
  best_movie_poster: string | null
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('home')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null)
  const [selectedWorkType, setSelectedWorkType] = useState<'movie' | 'tv'>('movie')
  const [toastMsg, setToastMsg] = useState('')
  const [streakBonus, setStreakBonus] = useState(0)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string; color: string; totalPoints: number } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s?.user) {
        setSession(s)
        loadUserProfile(s.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) { setUser(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      setToastMsg((e as CustomEvent).detail)
      setTimeout(() => setToastMsg(''), 3000)
    }
    window.addEventListener('filmo-toast', handler)
    return () => window.removeEventListener('filmo-toast', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setLevelUpData(detail)
    }
    window.addEventListener('filmo-levelup', handler)
    return () => window.removeEventListener('filmo-levelup', handler)
  }, [])

  const loadUserProfile = async (uid: string) => {
    try {
      const { data: doc } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single()
      if (doc) {
        setUser(doc as unknown as User)
        const { bonus } = await checkLoginStreak(uid)
        if (bonus > 0) setStreakBonus(bonus)

        // Check if user needs onboarding (< MIN_RATINGS_FOR_MATCH rated movies)
        try {
          const { data: watchlists } = await supabase
            .from('watchlists')
            .select('id, score')
            .eq('user_id', uid)
            .eq('status', 'watched')
            .limit(MIN_RATINGS_FOR_MATCH)
          const ratedCount = (watchlists || []).filter(d => d.score != null && d.score > 0).length
          if (ratedCount < MIN_RATINGS_FOR_MATCH) {
            setNeedsOnboarding(true)
          }
        } catch { /* ignore — proceed to dashboard */ }
      }
    } catch { /* user doc may not exist yet */ }
    setLoading(false)
  }

  const handleAuth = async () => {
    setAuthError('')
    setAuthLoading(true)
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: { name: authName || authEmail.split('@')[0] },
          },
        })
        if (error) throw error
        if (data.user) {
          // The handle_new_user trigger creates the users row automatically.
          // But we update with extra fields just in case:
          const { error: upsertError } = await supabase.from('users').upsert({
            id: data.user.id,
            email: authEmail,
            name: authName || authEmail.split('@')[0],
            level: 1,
            points: 0,
            login_streak: 0,
            bio: '',
          })
          if (upsertError) console.error('User upsert failed:', upsertError)
          setSession(data.session)
          setNeedsOnboarding(true)
          await loadUserProfile(data.user.id)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        })
        if (error) throw error
        setSession(data.session)
        if (data.user) await loadUserProfile(data.user.id)
      }
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : 'エラーが発生しました')
    }
    setAuthLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setTab('home')
  }

  const openWork = useCallback((id: number, type: 'movie' | 'tv' = 'movie') => {
    setSelectedWorkId(id)
    setSelectedWorkType(type)
  }, [])

  const closeWork = useCallback(() => {
    setSelectedWorkId(null)
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--fm-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎬</div>
          <div style={{ color: 'var(--fm-accent)', fontSize: 24, fontWeight: 700 }}>Filmo</div>
          <div style={{ color: 'var(--fm-text-sub)', marginTop: 8 }}>読み込み中...</div>
        </div>
      </div>
    )
  }

  if (!session || !user) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎬</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Filmo</h1>
            <p style={{ color: 'var(--fm-text-sub)', marginTop: 4 }}>映画・ドラマ・アニメの記録をもっと楽しく</p>
          </div>

          <div style={{ display: 'flex', marginBottom: 24, background: 'var(--fm-bg-card)', borderRadius: 12, padding: 4 }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthError('') }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: authMode === m ? 'var(--fm-accent)' : 'transparent',
                  color: authMode === m ? '#fff' : 'var(--fm-text-sub)',
                  fontWeight: 600, fontSize: 14, transition: 'all 0.2s',
                }}>
                {m === 'login' ? 'ログイン' : '新規登録'}
              </button>
            ))}
          </div>

          <div style={{ background: 'var(--fm-bg-card)', borderRadius: 16, padding: 24, border: '1px solid var(--fm-border)' }}>
            {authMode === 'signup' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6 }}>ニックネーム</label>
                <input value={authName} onChange={e => setAuthName(e.target.value)} placeholder="シネマ太郎"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6 }}>メールアドレス</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="your@email.com"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6 }}>パスワード</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 15, boxSizing: 'border-box' }} />
            </div>

            {authError && <div style={{ color: 'var(--fm-danger)', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,107,107,0.1)', borderRadius: 8 }}>{authError}</div>}

            <button onClick={handleAuth} disabled={authLoading}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))',
                color: '#fff', fontWeight: 700, fontSize: 16, opacity: authLoading ? 0.7 : 1,
              }}>
              {authLoading ? '処理中...' : authMode === 'login' ? 'ログイン' : 'アカウント作成'}
            </button>
          </div>

          <p style={{ textAlign: 'center', color: 'var(--fm-text-muted)', fontSize: 12, marginTop: 24 }}>
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
      </div>
    )
  }

  if (needsOnboarding) {
    return (
      <Onboarding
        userId={user.id}
        onComplete={() => setNeedsOnboarding(false)}
      />
    )
  }

  if (selectedWorkId !== null) {
    return (
      <WorkDetail
        workId={selectedWorkId}
        workType={selectedWorkType}
        userId={user.id}
        onClose={closeWork}
        onOpenWork={openWork}
      />
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--fm-bg)', borderBottom: '1px solid var(--fm-border)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: `0 2px 10px var(--fm-header-shadow)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>🎬</span>
          <span style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg, var(--fm-accent), var(--fm-accent-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Filmo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell userId={user.id} />
          <div style={{
            background: 'var(--fm-bg-card)', borderRadius: 20, padding: '4px 12px',
            fontSize: 12, color: 'var(--fm-accent)', fontWeight: 600,
            border: '1px solid var(--fm-border)',
          }}>
            Lv.{user.level} / {user.points}pt
          </div>
        </div>
      </header>

      {streakBonus > 0 && (
        <div className="animate-slide-up" style={{
          margin: '12px 16px', padding: '12px 16px', borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(108,92,231,0.2), rgba(162,155,254,0.1))',
          border: '1px solid var(--fm-accent)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <span style={{ fontSize: 14 }}>
            <strong>{user.login_streak}日連続ログイン!</strong> +{streakBonus}pt獲得
          </span>
          <button onClick={() => setStreakBonus(0)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--fm-text-sub)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <main style={{ padding: '0 0 80px 0' }}>
        {tab === 'home' && <Dashboard userId={user.id} onOpenWork={openWork} />}
        {tab === 'search' && <Search userId={user.id} onOpenWork={openWork} />}
        {tab === 'feed' && <Feed userId={user.id} onOpenWork={openWork} />}
        {tab === 'stats' && (
          <div>
            <Statistics userId={user.id} onOpenWork={openWork} />
            <Gamification userId={user.id} />
          </div>
        )}
        {tab === 'profile' && (
          <Profile
            user={user}
            onUpdate={(u: Partial<User>) => setUser(prev => prev ? { ...prev, ...u } : prev)}
            onLogout={handleLogout}
            onOpenWork={openWork}
          />
        )}
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--fm-bg)', borderTop: '1px solid var(--fm-border)',
        display: 'flex', justifyContent: 'space-around', padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
        boxShadow: '0 -2px 10px var(--fm-header-shadow)',
      }}>
        {([
          { key: 'home', icon: '🏠', label: 'ホーム' },
          { key: 'search', icon: '🔍', label: '検索' },
          { key: 'feed', icon: '👥', label: 'フィード' },
          { key: 'stats', icon: '📊', label: '統計' },
          { key: 'profile', icon: '👤', label: 'マイページ' },
        ] as { key: Tab; icon: string; label: string }[]).map(item => (
          <button key={item.key} onClick={() => setTab(item.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px',
              color: tab === item.key ? 'var(--fm-accent)' : 'var(--fm-text-muted)',
              fontSize: 10, fontWeight: tab === item.key ? 700 : 400,
            }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {toastMsg && <Toast message={toastMsg} />}

      {/* Level-up Share Card */}
      {levelUpData && user && (
        <ShareCard
          type="level_up"
          data={levelUpData}
          userId={user.id}
          onClose={() => setLevelUpData(null)}
        />
      )}
    </div>
  )
}
