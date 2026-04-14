'use client'

import { useLocale } from './context'
import { useCallback } from 'react'

/**
 * Hook that returns a fetch wrapper which automatically appends
 * the TMDB language parameter to /api/tmdb requests.
 */
export function useTmdbFetch() {
  const { tmdbLang } = useLocale()

  const tmdbFetch = useCallback((url: string, init?: RequestInit) => {
    // Only modify /api/tmdb requests
    if (url.startsWith('/api/tmdb')) {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}lang=${tmdbLang}`
    }
    return fetch(url, init)
  }, [tmdbLang])

  return tmdbFetch
}
