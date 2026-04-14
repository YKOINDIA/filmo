import { NextRequest, NextResponse } from 'next/server'
import Negotiator from 'negotiator'
import { match } from '@formatjs/intl-localematcher'

// --- Locale detection ---

const LOCALES = ['ja', 'en', 'ko', 'zh', 'es']
const DEFAULT_LOCALE = 'ja'
const LOCALE_COOKIE = 'filmo_locale'

function getPreferredLocale(request: NextRequest): string {
  // 1. Already set via cookie
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value
  if (cookieLocale && LOCALES.includes(cookieLocale)) return cookieLocale

  // 2. Negotiate from Accept-Language
  const headers: Record<string, string> = {}
  const acceptLang = request.headers.get('accept-language')
  if (acceptLang) headers['accept-language'] = acceptLang

  try {
    const languages = new Negotiator({ headers }).languages()
    return match(languages, LOCALES, DEFAULT_LOCALE)
  } catch {
    return DEFAULT_LOCALE
  }
}

// --- Rate limiting ---

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/tmdb':        { max: 30,  windowMs: 60_000 },
  '/api/ranking':     { max: 30,  windowMs: 60_000 },
  '/api/x-post':      { max: 5,   windowMs: 60_000 },
  '/api/cron':        { max: 5,   windowMs: 60_000 },
  '/api/announce':    { max: 10,  windowMs: 60_000 },
  '/api/translate':   { max: 20,  windowMs: 60_000 },
  '/api':             { max: 60,  windowMs: 60_000 },
}

function getLimit(pathname: string) {
  for (const [path, limit] of Object.entries(RATE_LIMITS)) {
    if (path !== '/api' && pathname.startsWith(path)) return limit
  }
  if (pathname.startsWith('/api')) return RATE_LIMITS['/api']
  return null
}

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // --- Rate limiting for API routes ---
  const limit = getLimit(pathname)
  if (limit) {
    const ip = getIP(request)
    const key = `${ip}:${pathname.split('/').slice(0, 3).join('/')}`
    const now = Date.now()

    const entry = rateLimitStore.get(key)

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + limit.windowMs })
    } else if (entry.count >= limit.max) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
            'X-RateLimit-Limit': String(limit.max),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    } else {
      entry.count++
    }

    const res = NextResponse.next()
    const e = rateLimitStore.get(key)
    if (e) {
      res.headers.set('X-RateLimit-Limit', String(limit.max))
      res.headers.set('X-RateLimit-Remaining', String(limit.max - e.count))
    }
    return res
  }

  // --- Locale detection for page routes ---
  // Skip static files, _next, api routes
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next()
  }

  const locale = getPreferredLocale(request)
  const res = NextResponse.next()

  // Set locale cookie if not present
  if (!request.cookies.get(LOCALE_COOKIE)?.value) {
    res.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
      sameSite: 'lax',
    })
  }

  // Set header for server components to read
  res.headers.set('x-filmo-locale', locale)

  return res
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|icon-|og-|sw.js|manifest.json).*)',
  ],
}
