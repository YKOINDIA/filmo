'use client'

import { useTranslation } from '../lib/i18n'

const FEATURE_KEYS = ['catalog', 'rating', 'stats', 'gamification', 'social', 'mobile'] as const
const FEATURE_ICONS: Record<typeof FEATURE_KEYS[number], string> = {
  catalog: '🎬',
  rating: '⭐',
  stats: '📊',
  gamification: '🏆',
  social: '👥',
  mobile: '📱',
}

const STAT_KEYS = ['works', 'free', 'rating', 'badges'] as const

const COMPARE_KEYS = [
  'stats', 'gamification', 'ratingStep', 'spoiler',
  'social', 'mobile', 'dark', 'ads',
] as const

export default function LandingPage() {
  const { t } = useTranslation()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fm-bg)', color: 'var(--fm-text)' }}>
      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', padding: '40px 20px',
        background: 'linear-gradient(180deg, rgba(108,92,231,0.15) 0%, var(--fm-bg) 100%)',
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎬</div>
        <h1 style={{
          fontSize: 'clamp(36px, 8vw, 64px)', fontWeight: 800,
          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 16, lineHeight: 1.2,
        }}>
          Filmo
        </h1>
        <p style={{ fontSize: 'clamp(16px, 3vw, 22px)', color: 'var(--fm-text-sub)', maxWidth: 600, marginBottom: 32, lineHeight: 1.6 }}>
          {t('landing.tagline')}<br />
          {t('landing.subTagline')}
        </p>

        <a href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '16px 40px', borderRadius: 12, fontSize: 18, fontWeight: 700,
          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff',
          textDecoration: 'none', transition: 'transform 0.2s, box-shadow 0.2s',
          boxShadow: '0 4px 20px rgba(108,92,231,0.4)',
        }}>
          {t('landing.ctaStart')}
        </a>

        <div style={{ marginTop: 48, display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
          {STAT_KEYS.map(k => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fm-accent)' }}>{t(`landing.stats.${k}.value`)}</div>
              <div style={{ fontSize: 13, color: 'var(--fm-text-muted)' }}>{t(`landing.stats.${k}.label`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 20px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 48 }}>
          {t('landing.featuresHeading')}
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {FEATURE_KEYS.map(k => (
            <div key={k} style={{
              background: 'var(--fm-bg-card)', borderRadius: 16, padding: 24,
              border: '1px solid var(--fm-border)', transition: 'transform 0.2s',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{FEATURE_ICONS[k]}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t(`landing.features.${k}.title`)}</h3>
              <p style={{ fontSize: 14, color: 'var(--fm-text-sub)', lineHeight: 1.6 }}>{t(`landing.features.${k}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section style={{ padding: '80px 20px', background: 'var(--fm-bg-card)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 48 }}>
            {t('landing.compareHeading')}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid var(--fm-border)' }}>{t('landing.compareCols.feature')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '2px solid var(--fm-border)', color: 'var(--fm-text-sub)' }}>{t('landing.compareCols.filmarks')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '2px solid var(--fm-border)', color: 'var(--fm-accent)', fontWeight: 700 }}>{t('landing.compareCols.filmo')}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_KEYS.map(k => (
                  <tr key={k}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--fm-border)' }}>{t(`landing.compareRows.${k}.feature`)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--fm-border)', color: 'var(--fm-text-muted)' }}>{t(`landing.compareRows.${k}.filmarks`)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--fm-border)', color: 'var(--fm-accent)', fontWeight: 600 }}>{t(`landing.compareRows.${k}.filmo`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '80px 20px', textAlign: 'center',
        background: 'linear-gradient(180deg, var(--fm-bg) 0%, rgba(108,92,231,0.1) 100%)',
      }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>{t('landing.ctaPanelHeading')}</h2>
        <p style={{ color: 'var(--fm-text-sub)', marginBottom: 32, fontSize: 16 }}>
          {t('landing.ctaPanelSub')}
        </p>
        <a href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '16px 48px', borderRadius: 12, fontSize: 18, fontWeight: 700,
          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff',
          textDecoration: 'none', boxShadow: '0 4px 20px rgba(108,92,231,0.4)',
        }}>
          {t('landing.ctaFree')}
        </a>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 20px', borderTop: '1px solid var(--fm-border)',
        textAlign: 'center', color: 'var(--fm-text-muted)', fontSize: 13,
      }}>
        <div style={{ marginBottom: 16, display: 'flex', gap: 24, justifyContent: 'center' }}>
          <a href="/legal" style={{ color: 'var(--fm-text-sub)', textDecoration: 'none' }}>{t('landing.footerLegal')}</a>
        </div>
        <div>{t('landing.footerCopyright', { year: new Date().getFullYear() })}</div>
        <div style={{ marginTop: 8 }}>{t('landing.footerData')}</div>
      </footer>
    </div>
  )
}
