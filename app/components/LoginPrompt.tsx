'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { useLocale } from '../lib/i18n'
import { setUserContext, trackSignUp, trackAuthStarted, trackAuthFailed, trackSignIn } from '../lib/analytics'

interface LoginPromptProps {
  /** 任意の見出し(タブ別の文言を渡せる)。例: "プロフィールを見るにはログインが必要です" */
  title?: string
  /** 任意のサブテキスト */
  subtitle?: string
  /** ログイン/サインアップ成功後のコールバック (uid を返す) */
  onAuthenticated?: (userId: string) => void
}

/**
 * ログイン/サインアップフォーム。
 *
 * App Store 1.0 まではトップ画面そのものだったが、
 * "ログインせずに使えるようにして" の改善で
 *   - プロフィール / フィード / マイリスト タブの未認証時表示
 *   - レビュー投稿等の認証必須アクションの誘導
 * に再利用するためコンポーネント化した。
 *
 * 利用規約・プライバシーポリシーへの同意 (EULA) は signup 時必須。
 * Apple ガイドライン 1.2 で要求されているもの。
 */
export default function LoginPrompt({ title, subtitle, onAuthenticated }: LoginPromptProps) {
  const { t } = useLocale()
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authAgreedToTerms, setAuthAgreedToTerms] = useState(false)

  const handleAuth = async () => {
    setAuthError('')
    setAuthSuccess('')
    trackAuthStarted(authMode)
    if (authMode === 'signup' && !authAgreedToTerms) {
      setAuthError('利用規約とプライバシーポリシーへの同意が必要です')
      trackAuthFailed('signup', 'terms_not_agreed')
      return
    }
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
          setAuthSuccess(t('auth.confirmEmail'))
          setAuthLoading(false)
          return
        }
        if (data.user) {
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
          trackSignUp('email')
          setUserContext({ authenticated: true, level: 1 })
          onAuthenticated?.(data.user.id)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        })
        if (error) throw error
        if (data.user) {
          trackSignIn()
          setUserContext({ authenticated: true })
          onAuthenticated?.(data.user.id)
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.error')
      trackAuthFailed(authMode, msg)
      setAuthError(msg)
    }
    setAuthLoading(false)
  }

  return (
    <div style={{
      minHeight: '60dvh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 800, letterSpacing: 3, color: 'var(--fm-text)',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            {title || 'Filmo'}
          </h1>
          <p style={{ color: 'var(--fm-text-sub)', marginTop: 4, fontSize: 14, lineHeight: 1.6 }}>
            {subtitle || t('auth.tagline')}
          </p>
        </div>

        <div style={{
          display: 'flex', marginBottom: 24,
          background: 'var(--fm-bg-card)', borderRadius: 12, padding: 4,
        }}>
          {(['login', 'signup'] as const).map(m => (
            <button key={m}
              onClick={() => { setAuthMode(m); setAuthError(''); setAuthSuccess('') }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: authMode === m ? 'var(--fm-accent)' : 'transparent',
                color: authMode === m ? '#fff' : 'var(--fm-text-sub)',
                fontWeight: 600, fontSize: 14, transition: 'all 0.2s',
              }}
            >
              {m === 'login' ? t('auth.login') : t('auth.signup')}
            </button>
          ))}
        </div>

        <div style={{
          background: 'var(--fm-bg-card)', borderRadius: 16, padding: 24,
          border: '1px solid var(--fm-border)',
        }}>
          {authMode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6 }}>
                {t('auth.nickname')}
              </label>
              <input value={authName} onChange={e => setAuthName(e.target.value)}
                placeholder={t('auth.nicknamePlaceholder')}
                style={inputStyle} />
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6 }}>
              {t('auth.email')}
            </label>
            <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)}
              placeholder="your@email.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 6 }}>
              {t('auth.password')}
            </label>
            <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              style={inputStyle} />
          </div>

          {authMode === 'signup' && (
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              marginBottom: 16, cursor: 'pointer',
              fontSize: 12, color: 'var(--fm-text-sub)', lineHeight: 1.6,
            }}>
              <input
                type="checkbox"
                checked={authAgreedToTerms}
                onChange={e => setAuthAgreedToTerms(e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0, width: 16, height: 16, cursor: 'pointer' }}
              />
              <span>
                <a href="/legal" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fm-accent)', textDecoration: 'underline' }}>利用規約</a>
                および
                <a href="/legal" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fm-accent)', textDecoration: 'underline' }}>プライバシーポリシー</a>
                に同意します。
                <br />
                <span style={{ color: 'var(--fm-text-muted)', fontSize: 11 }}>
                  Filmo は不快コンテンツ・濫用ユーザーをゼロ容認(zero-tolerance)します。
                </span>
              </span>
            </label>
          )}

          {authSuccess && (
            <div style={{
              color: 'var(--fm-accent)', fontSize: 13, marginBottom: 12, padding: '12px',
              background: 'rgba(0,192,48,0.1)', borderRadius: 8, lineHeight: 1.5,
            }}>{authSuccess}</div>
          )}
          {authError && (
            <div style={{
              color: 'var(--fm-danger)', fontSize: 13, marginBottom: 12, padding: '8px 12px',
              background: 'rgba(255,107,107,0.1)', borderRadius: 8,
            }}>{authError}</div>
          )}

          <button onClick={handleAuth}
            disabled={authLoading || (authMode === 'signup' && !authAgreedToTerms)}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
              cursor: authLoading || (authMode === 'signup' && !authAgreedToTerms) ? 'not-allowed' : 'pointer',
              background: authLoading || (authMode === 'signup' && !authAgreedToTerms) ? 'var(--fm-text-muted)' : 'var(--fm-accent)',
              color: '#fff', fontWeight: 700, fontSize: 15,
              transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {authLoading && (
              <span style={{
                width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                display: 'inline-block', animation: 'spin 0.6s linear infinite',
              }} />
            )}
            {authLoading ? t('auth.processing') : authMode === 'login' ? t('auth.login') : t('auth.createAccount')}
          </button>

          {authMode === 'login' && (
            <p style={{
              marginTop: 12, fontSize: 11, color: 'var(--fm-text-muted)',
              lineHeight: 1.5, textAlign: 'center',
            }}>
              ログインすることで、
              <a href="/legal" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fm-accent)' }}>利用規約</a>
              および
              <a href="/legal" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fm-accent)' }}>プライバシーポリシー</a>
              に同意したものとみなされます。
            </p>
          )}
        </div>

        {/* Filmo ゲーム (未ログインでも遊べる) */}
        <div style={{ marginTop: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 10, color: 'var(--fm-text-sub)',
            fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
          }}>
            <span style={{ fontSize: 16 }}>🎮</span>
            <span>ログインしなくても遊べる Filmo ゲーム</span>
          </div>
          <Link
            href="/games/emoji"
            style={{
              display: 'block', padding: 14, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(108,92,231,0.18), rgba(0,192,48,0.10))',
              border: '1px solid var(--fm-border)',
              textDecoration: 'none', color: 'inherit', marginBottom: 8,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>🚢💎🥶</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>絵文字タイトル当て</div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-sub)', marginTop: 2 }}>
                  絵文字から作品名を当てよう。全10問
                </div>
              </div>
              <div style={{ fontSize: 16, color: 'var(--fm-accent)' }}>→</div>
            </div>
          </Link>
          <Link
            href="/games/crystal-blast"
            style={{
              display: 'block', padding: 14, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(255,87,87,0.18), rgba(195,116,255,0.14))',
              border: '1px solid var(--fm-border)',
              textDecoration: 'none', color: 'inherit',
              marginBottom: 8,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>💎</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>CRYSTAL BLAST</div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-sub)', marginTop: 2 }}>
                  連鎖でぶっ飛ばせ！　ソロも対戦も
                </div>
                <div style={{
                  fontSize: 10, color: '#ffd24a', marginTop: 4, fontWeight: 600,
                }}>
                  ⚔️ オンライン対戦はログインが必要です！
                </div>
              </div>
              <div style={{ fontSize: 16, color: 'var(--fm-accent)' }}>→</div>
            </div>
          </Link>
          <Link
            href="/games/minesweeper"
            style={{
              display: 'block', padding: 14, borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.20), rgba(239,68,68,0.10))',
              border: '1px solid var(--fm-border)',
              textDecoration: 'none', color: 'inherit',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24 }}>💣</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Minesweeper</div>
                <div style={{ fontSize: 11, color: 'var(--fm-text-sub)', marginTop: 2 }}>
                  古典マインスイーパ。3難易度
                </div>
              </div>
              <div style={{ fontSize: 16, color: 'var(--fm-accent)' }}>→</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', borderRadius: 10,
  border: '1px solid var(--fm-border)', background: 'var(--fm-bg-input)',
  color: 'var(--fm-text)', fontSize: 15, boxSizing: 'border-box',
}
