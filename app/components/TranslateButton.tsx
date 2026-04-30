'use client'

import { useLocale, useReviewTranslation } from '@/app/lib/i18n'
import { trackTranslateClicked } from '@/app/lib/analytics'

interface Props {
  reviewId: string
  text: string
  /** Locale of the original review text (if known) */
  sourceLocale?: string
}

/**
 * Inline translate button for reviews.
 * Shows "Translate" link below review text.
 * Once translated, shows translated text with "Show original" toggle.
 */
export default function TranslateButton({ reviewId, text, sourceLocale }: Props) {
  const { locale, t } = useLocale()
  const { translate, toggleOriginal, getState } = useReviewTranslation(locale)
  const state = getState(reviewId)

  // Don't show translate button if the review is already in the user's language
  if (sourceLocale === locale) return null

  if (state.loading) {
    return (
      <span style={{ fontSize: 12, color: 'var(--fm-text-muted)', fontStyle: 'italic' }}>
        {t('review.translating')}
      </span>
    )
  }

  if (state.result && !state.showOriginal) {
    return (
      <div style={{ marginTop: 6 }}>
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(0,224,143,0.06)',
          border: '1px solid rgba(0,224,143,0.15)',
          fontSize: 14, lineHeight: 1.6,
        }}>
          {state.result.translated}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button
            onClick={() => toggleOriginal(reviewId)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--fm-accent)', padding: 0,
            }}
          >
            {t('review.showOriginal')}
          </button>
          <span style={{ fontSize: 11, color: 'var(--fm-text-muted)' }}>
            {t('translation.poweredBy', { provider: state.result.provider })}
          </span>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => {
        trackTranslateClicked(sourceLocale || 'unknown', locale)
        translate(reviewId, text)
      }}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 12, color: 'var(--fm-accent)', padding: 0,
        marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8l6 6" /><path d="M4 14l6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" />
        <path d="M22 22l-5-10-5 10" /><path d="M14 18h6" />
      </svg>
      {t('review.translate')}
    </button>
  )
}
