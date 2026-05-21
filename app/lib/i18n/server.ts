/**
 * Server-side i18n helper for SSR / generateMetadata.
 *
 * Reads the locale from `filmo_locale` cookie (set by the client `LocaleProvider`)
 * with `Accept-Language` as fallback, then loads the matching dictionary.
 *
 * Note: using cookies()/headers() opts the calling route into dynamic rendering,
 * which disables `export const revalidate`. The TMDB / Supabase data layers
 * still cache, so the cost is mostly per-request HTML rendering.
 */
import { cookies, headers } from 'next/headers'
import { defaultLocale, isValidLocale, LOCALE_COOKIE, locales } from './config'
import type { Locale } from './config'
import type { Dictionary } from './types'

const dictionaryCache: Partial<Record<Locale, Dictionary>> = {}

async function loadDictionary(locale: Locale): Promise<Dictionary> {
  if (dictionaryCache[locale]) return dictionaryCache[locale]!
  const mod = await import(`./dictionaries/${locale}.json`)
  const dict = mod.default as Dictionary
  dictionaryCache[locale] = dict
  return dict
}

function resolveKey(dict: Dictionary, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = dict
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

function pickFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const lang = part.split(';')[0].trim().split('-')[0].toLowerCase()
    if (isValidLocale(lang)) return lang as Locale
  }
  return null
}

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale as Locale

  const hdrs = await headers()
  return pickFromAcceptLanguage(hdrs.get('accept-language')) ?? defaultLocale
}

export type ServerT = (key: string, params?: Record<string, string | number>) => string

export interface ServerDictionary {
  locale: Locale
  dict: Dictionary
  t: ServerT
}

export async function getServerDictionary(): Promise<ServerDictionary> {
  const locale = await getServerLocale()
  const dict = await loadDictionary(locale)
  const t: ServerT = (key, params) => {
    const value = resolveKey(dict, key)
    if (!value) return key
    return interpolate(value, params)
  }
  return { locale, dict, t }
}

/** Map app locale to OpenGraph locale (e.g. ja_JP). */
const OG_LOCALE_MAP: Record<Locale, string> = {
  ja: 'ja_JP',
  en: 'en_US',
  ko: 'ko_KR',
  zh: 'zh_CN',
  es: 'es_ES',
}

export function toOgLocale(locale: Locale): string {
  return OG_LOCALE_MAP[locale]
}

export function alternateOgLocales(current: Locale): string[] {
  return locales.filter(l => l !== current).map(l => OG_LOCALE_MAP[l])
}
