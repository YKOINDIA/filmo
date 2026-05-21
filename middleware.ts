import { NextRequest, NextResponse } from 'next/server'

// ============================================================
// Filmo middleware
// ============================================================
// このミドルウェアの責務は **/api/* のレートリミットのみ**。
//
// 過去はロケール検出 (cookie 設定 + x-filmo-locale ヘッダ) も行っていたが、
// 実際のロケール解決は client 側の `LocaleProvider` (app/lib/i18n/context.tsx)
// が cookie / localStorage / navigator.language の順に行っており、
// middleware 側の処理は冗長で誰にも参照されていなかった。
//
// ページリクエスト毎に middleware を invoke すると Vercel の Function
// Invocations / Active CPU を不必要に消費するため、matcher を `/api/:path*`
// に限定して全ページの中継から外している。

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

  // matcher で /api/* に限定しているが、念のためここでも guard。
  const limit = getLimit(pathname)
  if (!limit) return NextResponse.next()

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
      },
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

export const config = {
  // ロケール検出を client に寄せたので、ページリクエストでは middleware を
  // 走らせない。レートリミット対象の /api/* だけが対象。
  matcher: ['/api/:path*'],
}
