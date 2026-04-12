import { NextRequest, NextResponse } from 'next/server'
import { cronGuard } from '../../../lib/cronGuard'
import { createAdminClient, DB_ID, COLLECTIONS, Query, ID } from '../../../lib/appwrite-server'

export async function GET(req: NextRequest) {
  const guard = await cronGuard(req, 'check-anomaly')
  if (guard) return guard

  try {
    const { databases } = createAdminClient()
    const alerts: string[] = []
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()

    // 大量登録チェック
    const newUsers = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
      Query.greaterThan('$createdAt', oneHourAgo),
      Query.limit(1),
    ])
    if (newUsers.total > 10) {
      await databases.createDocument(DB_ID, COLLECTIONS.ADMIN_ALERTS, ID.unique(), {
        type: 'mass_registration',
        severity: 'warning',
        detail: JSON.stringify({ count: newUsers.total, period: '1h' }),
        is_read: false,
      })
      alerts.push(`Mass registration: ${newUsers.total} signups in 1h`)
    }

    // スパムレビューチェック
    const recentReviews = await databases.listDocuments(DB_ID, COLLECTIONS.REVIEWS, [
      Query.greaterThan('$createdAt', oneHourAgo),
      Query.limit(100),
    ])
    const reviewsByUser: Record<string, number> = {}
    for (const r of recentReviews.documents) {
      reviewsByUser[r.user_id] = (reviewsByUser[r.user_id] || 0) + 1
    }
    for (const [uid, count] of Object.entries(reviewsByUser)) {
      if (count > 20) {
        await databases.createDocument(DB_ID, COLLECTIONS.ADMIN_ALERTS, ID.unique(), {
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
      const settings = await databases.listDocuments(DB_ID, COLLECTIONS.CRON_SETTINGS, [
        Query.equal('path', 'check-anomaly'),
      ])
      if (settings.documents.length > 0) {
        await databases.updateDocument(DB_ID, COLLECTIONS.CRON_SETTINGS, settings.documents[0].$id, {
          last_run: new Date().toISOString(),
          last_status: alerts.length > 0 ? `${alerts.length} alerts` : 'ok',
        })
      }
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, alerts })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
