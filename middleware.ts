import { NextRequest, NextResponse } from 'next/server'

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/tmdb':        { max: 30,  windowMs: 60_000 },
  '/api/ranking':     { max: 30,  windowMs: 60_000 },
  '/api/x-post':      { max: 5,   windowMs: 60_000 },
  '/api/cron':        { max: 5,   windowMs: 60_000 },
  '/api/announce':    { max: 10,  windowMs: 60_000 },
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
  const limit = getLimit(pathname)
  if (!limit) return NextResponse.next()

  const ip = getIP(request)
  const key = `${ip}:${pathname.split('/').slice(0, 3).join('/')}`
  const now = Date.now()

  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + limit.windowMs })
    return NextResponse.next()
  }

  if (entry.count >= limit.max) {
    return new NextResponse(
      JSON.stringify({ error: 'リクエストが多すぎます。しばらくしてから再試行してください。' }),
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
  }

  entry.count++

  const res = NextResponse.next()
  res.headers.set('X-RateLimit-Limit', String(limit.max))
  res.headers.set('X-RateLimit-Remaining', String(limit.max - entry.count))
  return res
}

export const config = {
  matcher: '/api/:path*',
}
