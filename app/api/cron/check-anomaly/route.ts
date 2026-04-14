import { NextRequest, NextResponse } from 'next/server'
import { cronGuard } from '../../../lib/cronGuard'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'

export async function GET(req: NextRequest) {
  const guard = await cronGuard(req, 'check-anomaly')
  if (guard) return guard

  try {
    const admin = getSupabaseAdmin()
    const alerts: string[] = []
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()

    // 大量登録チェック
    const { count: newUserCount } = await admin.from('users')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', oneHourAgo)

    if ((newUserCount ?? 0) > 10) {
      await admin.from('admin_alerts').insert({
        type: 'mass_registration',
        severity: 'warning',
        detail: JSON.stringify({ count: newUserCount, period: '1h' }),
        is_read: false,
      })
      alerts.push(`Mass registration: ${newUserCount} signups in 1h`)
    }

    // スパムレビューチェック
    const { data: recentReviews } = await admin.from('reviews')
      .select('*')
      .gt('created_at', oneHourAgo)
      .limit(100)

    const reviewsByUser: Record<string, number> = {}
    for (const r of (recentReviews || [])) {
      reviewsByUser[r.user_id] = (reviewsByUser[r.user_id] || 0) + 1
    }
    for (const [uid, count] of Object.entries(reviewsByUser)) {
      if (count > 20) {
        await admin.from('admin_alerts').insert({
          type: 'spam_reviews',
          severity: 'warning',
          detail: JSON.stringify({ user_id: uid, count, period: '1h' }),
          is_read: false,
        })
        alerts.push(`Spam reviews: user ${uid} posted ${count} reviews in 1h`)
      }
    }

    // Cron設定更新
    try {
      const { data: settings } = await admin.from('cron_settings')
        .select('*')
        .eq('path', 'check-anomaly')

      if (settings && settings.length > 0) {
        await admin.from('cron_settings').update({
          last_run: new Date().toISOString(),
          last_status: alerts.length > 0 ? `${alerts.length} alerts` : 'ok',
        }).eq('id', settings[0].id)
      }
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, alerts })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
