export const defaultLocale = 'ja' as const
export const locales = ['ja', 'en', 'ko', 'zh', 'es'] as const
export type Locale = (typeof locales)[number]

export const localeNames: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  ko: '한국어',
  zh: '中文',
  es: 'Español',
}

/** Map app locale to TMDB language parameter */
export const tmdbLanguageMap: Record<Locale, string> = {
  ja: 'ja-JP',
  en: 'en-US',
  ko: 'ko-KR',
  zh: 'zh-CN',
  es: 'es-ES',
}

export const LOCALE_COOKIE = 'filmo_locale'

export function isValidLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale)
}
