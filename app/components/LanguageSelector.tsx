'use client'

import { useLocale } from '@/app/lib/i18n'
import { locales, localeNames } from '@/app/lib/i18n/config'

export default function LanguageSelector() {
  const { locale, setLocale, t } = useLocale()

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, color: 'var(--fm-text-sub)', marginBottom: 8, fontWeight: 600 }}>
        {t('settings.language')}
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {locales.map(loc => (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: locale === loc ? '2px solid var(--fm-accent)' : '1px solid var(--fm-border)',
              background: locale === loc ? 'rgba(0,224,143,0.1)' : 'var(--fm-bg-card)',
              color: locale === loc ? 'var(--fm-accent)' : 'var(--fm-text)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: locale === loc ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            {localeNames[loc]}
          </button>
        ))}
      </div>
    </div>
  )
}
