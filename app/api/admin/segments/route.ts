import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
import { isAdminEmail } from '../../../lib/adminAuth'

/**
 * 管理画面 Segment 集計エンドポイント。
 *
 * GET /api/admin/segments?email=admin@... → JSON
 *
 * 集計軸:
 *   country (ISO 2-letter)
 *   birthDecade (60s/70s/80s/90s/00s/10s)
 *   gender
 *   level (1-99 → 1-3, 4-7, 8+)
 *   signupCohort (signup month YYYY-MM)
 *
 * 100K user スケールでは全 user 行を1回だけ select して JS で集計する方が
 * 軸ごとに COUNT(*) GROUP BY を発行するより効率的 (1回のクエリ vs 5回)。
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()

  // System user は除外
  const { data, error } = await admin
    .from('users')
    .select('id, country, birth_year, gender, level, created_at')
    .neq('id', '00000000-0000-0000-0000-000000000001')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Row = {
    id: string
    country: string | null
    birth_year: number | null
    gender: string | null
    level: number | null
    created_at: string
  }
  const rows = (data || []) as Row[]
  const total = rows.length

  // ── 軸別集計 ──
  const countByKey = (key: keyof Row, normalize?: (v: unknown) => string | null) => {
    const m = new Map<string, number>()
    let unknown = 0
    for (const r of rows) {
      const raw = r[key]
      const k = normalize ? normalize(raw) : (raw == null ? null : String(raw))
      if (k == null) { unknown++; continue }
      m.set(k, (m.get(k) || 0) + 1)
    }
    const arr = [...m.entries()]
      .map(([key, count]) => ({ key, count, pct: total > 0 ? count / total : 0 }))
      .sort((a, b) => b.count - a.count)
    return { breakdown: arr, unknown, total }
  }

  return NextResponse.json({
    total,
    byCountry: countByKey('country'),
    byGender: countByKey('gender'),
    byBirthDecade: countByKey('birth_year', (y) => {
      if (typeof y !== 'number') return null
      return `${Math.floor(y / 10) * 10}s`
    }),
    byLevel: countByKey('level', (l) => {
      if (typeof l !== 'number') return null
      if (l <= 3) return '1-3 (初級)'
      if (l <= 7) return '4-7 (中級)'
      return '8+ (上級)'
    }),
    bySignupCohort: countByKey('created_at', (d) => {
      if (typeof d !== 'string') return null
      return d.slice(0, 7) // YYYY-MM
    }),
  })
}
