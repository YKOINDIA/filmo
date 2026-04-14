'use client'

import { useState, useCallback } from 'react'
import type { Locale } from './config'

interface TranslationResult {
  translated: string
  source: string
  provider: string
}

interface TranslationState {
  [reviewId: string]: {
    loading: boolean
    result?: TranslationResult
    showOriginal: boolean
    error?: string
  }
}

/**
 * Hook for translating reviews on demand.
 * Caches results per review ID to avoid duplicate API calls.
 */
export function useReviewTranslation(targetLocale: Locale) {
  const [translations, setTranslations] = useState<TranslationState>({})

  const translate = useCallback(async (reviewId: string, text: string) => {
    // Already translated
    if (translations[reviewId]?.result) {
      setTranslations(prev => ({
        ...prev,
        [reviewId]: { ...prev[reviewId], showOriginal: false },
      }))
      return
    }

    setTranslations(prev => ({
      ...prev,
      [reviewId]: { loading: true, showOriginal: false },
    }))

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target: targetLocale }),
      })

      if (!res.ok) throw new Error('Translation failed')
      const result: TranslationResult = await res.json()

      setTranslations(prev => ({
        ...prev,
        [reviewId]: { loading: false, result, showOriginal: false },
      }))
    } catch (e) {
      setTranslations(prev => ({
        ...prev,
        [reviewId]: { loading: false, showOriginal: false, error: (e as Error).message },
      }))
    }
  }, [targetLocale, translations])

  const toggleOriginal = useCallback((reviewId: string) => {
    setTranslations(prev => ({
      ...prev,
      [reviewId]: prev[reviewId]
        ? { ...prev[reviewId], showOriginal: !prev[reviewId].showOriginal }
        : { loading: false, showOriginal: false },
    }))
  }, [])

  const getState = useCallback((reviewId: string) => {
    return translations[reviewId] || { loading: false, showOriginal: true }
  }, [translations])

  return { translate, toggleOriginal, getState }
}
