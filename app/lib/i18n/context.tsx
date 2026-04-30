'use client'

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { defaultLocale, locales, LOCALE_COOKIE, isValidLocale, tmdbLanguageMap } from './config'
import type { Locale } from './config'
import type { Dictionary } from './types'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  /** TMDB language parameter for current locale */
  tmdbLang: string
  dictionary: Dictionary
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

// Lazy-load dictionaries
const dictionaryLoaders: Record<Locale, () => Promise<Dictionary>> = {
  ja: () => import('./dictionaries/ja.json').then(m => m.default),
  en: () => import('./dictionaries/en.json').then(m => m.default),
  ko: () => import('./dictionaries/ko.json').then(m => m.default),
  zh: () => import('./dictionaries/zh.json').then(m => m.default),
  es: () => import('./dictionaries/es.json').then(m => m.default),
}

// Cache loaded dictionaries in memory
const dictionaryCache: Partial<Record<Locale, Dictionary>> = {}

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

function detectBrowserLocale(): Locale {
  // 1. Check cookie
  const cookieLocale = getCookie(LOCALE_COOKIE)
  if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale

  // 2. Check localStorage
  const stored = localStorage.getItem(LOCALE_COOKIE)
  if (stored && isValidLocale(stored)) return stored

  // 3. Check browser language
  for (const lang of navigator.languages ?? [navigator.language]) {
    const primary = lang.split('-')[0].toLowerCase()
    if (isValidLocale(primary)) return primary
    // Handle zh-CN, zh-TW -> zh
    if (primary === 'zh') return 'zh'
  }

  return defaultLocale
}

/** Resolve a nested key like "auth.login" from a dictionary */
function resolveKey(dict: Dictionary, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = dict
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

/** Interpolate {param} placeholders */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [dictionary, setDictionary] = useState<Dictionary | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Detect locale on mount
  useEffect(() => {
    const detected = detectBrowserLocale()
    setLocaleState(detected)
    loadDictionary(detected)
  }, [])

  const loadDictionary = async (loc: Locale) => {
    if (dictionaryCache[loc]) {
      setDictionary(dictionaryCache[loc])
      setInitialized(true)
      return
    }
    const dict = await dictionaryLoaders[loc]()
    dictionaryCache[loc] = dict
    setDictionary(dict)
    setInitialized(true)
  }

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(prev => {
      if (prev !== newLocale) {
        // Analytics: 言語切替を記録 (動的 import で循環参照回避)
        import('../analytics').then(a => a.trackLanguageChanged(prev, newLocale)).catch(() => {})
      }
      return newLocale
    })
    setCookie(LOCALE_COOKIE, newLocale)
    localStorage.setItem(LOCALE_COOKIE, newLocale)
    document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : newLocale
    loadDictionary(newLocale)
    // Analytics: locale を user property にも反映
    import('../analytics').then(a => a.setUserContext({ locale: newLocale })).catch(() => {})
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    if (!dictionary) return key
    const value = resolveKey(dictionary, key)
    if (!value) return key
    return interpolate(value, params)
  }, [dictionary])

  const tmdbLang = useMemo(() => tmdbLanguageMap[locale], [locale])

  // During SSR or before initialization, use a minimal fallback
  if (!initialized || !dictionary) {
    return (
      <LocaleContext.Provider value={{
        locale: defaultLocale,
        setLocale,
        t: (key: string) => key,
        tmdbLang: tmdbLanguageMap[defaultLocale],
        dictionary: {} as Dictionary,
      }}>
        {children}
      </LocaleContext.Provider>
    )
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, tmdbLang, dictionary }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}

export function useTranslation() {
  const { t, locale } = useLocale()
  return { t, locale }
}
