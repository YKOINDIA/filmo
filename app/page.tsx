'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { checkLoginStreak } from './lib/points'
import { useLocale } from './lib/i18n'
import Dashboard from './components/Dashboard'
import Search from './components/Search'
import WorkDetail from './components/WorkDetail'
import Profile from './components/Profile'
import Feed from './components/Feed'
import Statistics from './components/Statistics'
import Settings from './components/Settings'
import Gamification from './components/Gamification'
import UserLists from './components/UserLists'
import NotificationBell from './components/NotificationBell'
import Toast from './components/Toast'
import { showToast } from './lib/toast'
import Onboarding from './components/Onboarding'
import ShareCard from './components/ShareCard'
import PersonDetail from './components/PersonDetail'
import { MIN_RATINGS_FOR_MATCH } from './lib/matchScore'

type Tab = 'home' | 'search' | 'feed' | 'lists' | 'profile'

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
  const { t, tmdbLang } = useLocale()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('home')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null)
  const [selectedWorkType, setSelectedWorkType] = useState<'movie' | 'tv'>('movie')
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [streakBonus, setStreakBonus] = useState(0)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string; color: string; totalPoints: number } | null>(null)

  useEffect(() => {
    // Capacitor 環境なら splash を明示的に隠す。
    // capacitor.config.ts で launchAutoHide=false にしているため、
    // ここで呼ばないと最大 5秒間 splash が表示され続ける。
    // Web (Vercel 直接アクセス) では import が no-op になる。
    ;(async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide()
      } catch { /* not in Capacitor */ }
    })()

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
    setAuthSuccess('')
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
        if (data.user && !data.session) {
          // Email confirmation required — show success message
          setAuthSuccess(t('auth.confirmEmail'))
          setAuthLoading(false)
          return
        }
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
      setAuthError(e instanceof Error ? e.message : t('common.error'))
    }
    setAuthLoading(false)
  }

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setSession(null)
      setTab('home')
      showToast('ログアウトしました')
    } catch (err) {
      console.error('Logout failed:', err)
      showToast('ログアウトに失敗しました')
    } finally {
      setLoggingOut(false)
    }
  }

  const openWork = useCallback((id: number, type: 'movie' | 'tv' = 'movie') => {
    setSelectedPersonId(null)
    setSelectedWorkId(id)
    setSelectedWorkType(type)
  }, [])

  const closeWork = useCallback(() => {
    setSelectedWorkId(null)
  }, [])

  const openPerson = useCallback((id: number) => {
    setSelectedPersonId(id)
  }, [])

  const closePerson = useCallback(() => {
    setSelectedPersonId(null)
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--fm-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎬</div>
          <div style={{ color: 'var(--fm-accent)', fontSize: 24, fontWeight: 700 }}>Filmo</div>
          <div style={{ color: 'var(--fm-text-sub)', marginTop: 8 }}>{t('common.loading')}</div>
        </div>
      </div>
    )
  }

  if (!session || !user) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: 3, color: 'var(--fm-text)', textTransform: 'uppercase', marginBottom: 8 }}>Filmo</h1>
            <p style={{ color: 'var(--fm-text-sub)', marginTop: 4, fontSize: 14 }}>{t('auth.tagline')}</p>
            <p style={{ color: 'var(--fm-text-muted)', marginTop: 2, fontSize: 13 }}>{t('auth.taglineSub')}</p>
          </div>

          <div style={{ display: 'flex', marginBottom: 24, background: 'var(--fm-bg-card)', borderRadius: 12, padding: 4 }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthError(''); setAuthSuccess('') }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: authMode === m ? 'var(--fm-accent)' : 'transparent',
                  color: authMode === m ? '#fff' : 'var(--fm-text-sub)',
                  fontWeight: 600, fontSize: 14, transition: 'all 0.2s',
                }}>
                {m === 'login' ? t('auth.login') : t('auth.signup')}
              </button>
            ))}
          </div>

          <div style={{ background: 'var(--fm-bg-card)', borderRadius: 16, padding: 24, border: '1px solid var(--fm-border)' }}>
            {authMode === 'signup' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6 }}>{t('auth.nickname')}</label>
                <input value={authName} onChange={e => setAuthName(e.target.value)} placeholder={t('auth.nicknamePlaceholder')}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6 }}>{t('auth.email')}</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="your@email.com"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6 }}>{t('auth.password')}</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)', color: 'var(--fm-text)', fontSize: 15, boxSizing: 'border-box' }} />
            </div>

            {authSuccess && <div style={{ color: 'var(--fm-accent)', fontSize: 13, marginBottom: 12, padding: '12px', background: 'rgba(0,192,48,0.1)', borderRadius: 8, lineHeight: 1.5 }}>{authSuccess}</div>}
            {authError && <div style={{ color: 'var(--fm-danger)', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,107,107,0.1)', borderRadius: 8 }}>{authError}</div>}

            <button onClick={handleAuth} disabled={authLoading}
              style={{
                width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
                cursor: authLoading ? 'not-allowed' : 'pointer',
                background: authLoading ? 'var(--fm-text-muted)' : 'var(--fm-accent)',
                color: '#fff', fontWeight: 700, fontSize: 15,
                transition: 'background 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              {authLoading && (
                <span style={{
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.6s linear infinite',
                }} />
              )}
              {authLoading ? t('auth.processing') : authMode === 'login' ? t('auth.login') : t('auth.createAccount')}
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

  if (selectedPersonId !== null) {
    return (
      <PersonDetail
        personId={selectedPersonId}
        userId={user.id}
        onClose={closePerson}
        onOpenWork={openWork}
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
        onOpenPerson={openPerson}
      />
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--fm-bg)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--fm-bg)', borderBottom: '1px solid var(--fm-border)',
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1.5, color: 'var(--fm-text)', textTransform: 'uppercase' }}>Filmo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NotificationBell userId={user.id} />
          <div style={{
            background: 'var(--fm-bg-card)', borderRadius: 20, padding: '4px 12px',
            fontSize: 11, color: 'var(--fm-accent)', fontWeight: 600,
            border: '1px solid var(--fm-border)',
          }}>
            Lv.{user.level}
          </div>
        </div>
      </header>

      {streakBonus > 0 && (
        <div className="animate-slide-up" style={{
          margin: '12px 16px', padding: '12px 16px', borderRadius: 10,
          background: 'rgba(0,192,48,0.08)',
          border: '1px solid rgba(0,192,48,0.25)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <span style={{ fontSize: 14 }}>
            <strong>{t('streak.bonus', { days: String(user.login_streak) })}</strong> {t('streak.points', { points: String(streakBonus) })}
          </span>
          <button onClick={() => setStreakBonus(0)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--fm-text-sub)', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <main style={{ padding: '0 0 80px 0' }}>
        {tab === 'home' && <Dashboard userId={user.id} onOpenWork={openWork} />}
        {tab === 'search' && <Search userId={user.id} onOpenWork={openWork} />}
        {tab === 'feed' && <Feed userId={user.id} onOpenWork={openWork} />}
        {tab === 'lists' && <UserLists userId={user.id} onOpenWork={openWork} />}
        {tab === 'profile' && (
          <div>
            <Profile
              user={user}
              onUpdate={(u: Partial<User>) => setUser(prev => prev ? { ...prev, ...u } : prev)}
              onLogout={handleLogout}
              onOpenWork={openWork}
            />
            <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
              <Statistics userId={user.id} onOpenWork={openWork} />
              <Gamification userId={user.id} />
            </div>
          </div>
        )}
      </main>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--fm-bg)', borderTop: '1px solid var(--fm-border)',
        display: 'flex', justifyContent: 'space-around', padding: '6px 0 max(6px, env(safe-area-inset-bottom))',
      }}>
        {([
          { key: 'home', labelKey: 'nav.home', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
          { key: 'search', labelKey: 'nav.search', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
          { key: 'feed', labelKey: 'nav.feed', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
          { key: 'lists', labelKey: 'nav.lists', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
          { key: 'profile', labelKey: 'nav.profile', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4-4v2"/><circle cx="12" cy="7" r="4"/></svg> },
        ] as { key: Tab; labelKey: string; icon: React.ReactNode }[]).map(item => (
          <button key={item.key} onClick={() => setTab(item.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px',
              color: tab === item.key ? 'var(--fm-accent)' : 'var(--fm-text-muted)',
              fontSize: 10, fontWeight: tab === item.key ? 600 : 400,
              letterSpacing: 0.3,
            }}>
            {item.icon}
            {t(item.labelKey)}
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
