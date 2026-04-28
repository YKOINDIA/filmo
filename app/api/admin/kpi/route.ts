import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'ykoindia@gmail.com'

/**
 * 管理画面 KPI 集計エンドポイント。
 *
 * クライアントから 100K 行を取らせるのは非現実的なので、すべてサーバー側で
 * COUNT(*) ベースで集計する。
 *
 * GET /api/admin/kpi?email=admin@... → JSON
 *
 * 返却:
 *   totals: { users, reviews, watches, lists, comments }
 *   today:  { newUsers, newReviews, newWatches }
 *   activeUsers: { dau, wau, mau }
 *   retention: { d1, d7, d30 } -- N日前 signup user で N日後にも活動した割合
 *   funnel: { signup, firstWatched, firstReview }
 *   timeseries: 過去30日の新規登録 / 新規レビュー / 新規 watched 数
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email || email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // --- 並列で全count取得 ---
  const [
    usersCount,
    reviewsCount,
    watchesCount,
    listsCount,
    commentsCount,
    newUsersToday,
    newReviewsToday,
    newWatchesToday,
    // DAU: 過去24h に活動 (watchlist insert/update OR review insert OR list_like insert) があったユーザー数
    // 簡易実装: watchlists.updated_at を活動時刻として使う
    dauRows,
    wauRows,
    mauRows,
    // funnel
    firstWatchedUsers,
    firstReviewUsers,
  ] = await Promise.all([
    admin.from('users').select('*', { count: 'exact', head: true }).neq('id', '00000000-0000-0000-0000-000000000001'),
    admin.from('reviews').select('*', { count: 'exact', head: true }).eq('is_draft', false),
    admin.from('watchlists').select('*', { count: 'exact', head: true }),
    admin.from('user_lists').select('*', { count: 'exact', head: true }).eq('is_curated', false),
    admin.from('list_comments').select('*', { count: 'exact', head: true }),
    admin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today),
    admin.from('reviews').select('*', { count: 'exact', head: true }).eq('is_draft', false).gte('created_at', today),
    admin.from('watchlists').select('*', { count: 'exact', head: true }).gte('created_at', today),
    admin.from('watchlists').select('user_id').gte('updated_at', yesterday),
    admin.from('watchlists').select('user_id').gte('updated_at', last7),
    admin.from('watchlists').select('user_id').gte('updated_at', last30),
    admin.from('watchlists').select('user_id', { count: 'exact', head: true }).eq('status', 'watched'),
    admin.from('reviews').select('user_id', { count: 'exact', head: true }).eq('is_draft', false),
  ])

  // unique 化
  const uniqUsers = (rows: { data: { user_id: string }[] | null }) =>
    new Set((rows.data || []).map(r => r.user_id)).size

  const dau = uniqUsers(dauRows as { data: { user_id: string }[] | null })
  const wau = uniqUsers(wauRows as { data: { user_id: string }[] | null })
  const mau = uniqUsers(mauRows as { data: { user_id: string }[] | null })

  // --- 30日 timeseries (signup, review, watch) ---
  // 1日単位で COUNT を取るのは N=30 だと素直に並列で30クエリは重い。
  // signup 日付一覧を取って JS で日次集計する (ユーザーが 100K 行レベルなら問題なし、
  // 1M 超えたら materialized view 化する PR 2 で対応)
  const seriesStart = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
  const seriesStartIso = new Date(seriesStart.getFullYear(), seriesStart.getMonth(), seriesStart.getDate()).toISOString()

  const [signupSeriesRes, reviewSeriesRes, watchSeriesRes] = await Promise.all([
    admin.from('users').select('created_at').gte('created_at', seriesStartIso).neq('id', '00000000-0000-0000-0000-000000000001'),
    admin.from('reviews').select('created_at').eq('is_draft', false).gte('created_at', seriesStartIso),
    admin.from('watchlists').select('created_at').gte('created_at', seriesStartIso),
  ])

  const bucketBy = (rows: { created_at: string }[] | null) => {
    const buckets = new Map<string, number>()
    for (let i = 0; i < 30; i++) {
      const d = new Date(seriesStart.getTime() + i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      buckets.set(key, 0)
    }
    for (const r of rows || []) {
      const key = r.created_at.slice(0, 10)
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1)
    }
    return [...buckets.entries()].map(([date, count]) => ({ date, count }))
  }

  const timeseries = {
    signups: bucketBy(signupSeriesRes.data as { created_at: string }[] | null),
    reviews: bucketBy(reviewSeriesRes.data as { created_at: string }[] | null),
    watches: bucketBy(watchSeriesRes.data as { created_at: string }[] | null),
  }

  // --- リテンション D1 / D7 / D30 ---
  // signup_date が N日前 のユーザーのうち、活動 (watchlists.updated_at) が +N日後 にあった割合。
  const retention = await calculateRetention(admin, [1, 7, 30])

  return NextResponse.json({
    totals: {
      users: usersCount.count ?? 0,
      reviews: reviewsCount.count ?? 0,
      watches: watchesCount.count ?? 0,
      lists: listsCount.count ?? 0,
      comments: commentsCount.count ?? 0,
    },
    today: {
      newUsers: newUsersToday.count ?? 0,
      newReviews: newReviewsToday.count ?? 0,
      newWatches: newWatchesToday.count ?? 0,
    },
    activeUsers: { dau, wau, mau },
    funnel: {
      signup: usersCount.count ?? 0,
      firstWatched: firstWatchedUsers.count ?? 0,
      firstReview: firstReviewUsers.count ?? 0,
    },
    retention,
    timeseries,
  })
}

interface AdminClient {
  from: (table: string) => {
    select: (cols: string, opts?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) => {
      gte: (col: string, val: string) => {
        lt: (col: string, val: string) => Promise<{ count: number | null; data: unknown }>
      }
      in: (col: string, vals: string[]) => Promise<{ data: unknown }>
    }
  }
}

async function calculateRetention(admin: ReturnType<typeof getSupabaseAdmin>, days: number[]) {
  const now = Date.now()
  const result: Record<string, { cohort: number; retained: number; rate: number }> = {}

  for (const d of days) {
    const cohortStart = new Date(now - (d + 1) * 24 * 60 * 60 * 1000).toISOString()
    const cohortEnd = new Date(now - d * 24 * 60 * 60 * 1000).toISOString()
    const checkAfter = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()

    const { data: cohortUsers } = await admin
      .from('users')
      .select('id')
      .gte('created_at', cohortStart)
      .lt('created_at', cohortEnd)

    const cohortIds = (cohortUsers || []).map((u: { id: string }) => u.id)
    if (cohortIds.length === 0) {
      result[`d${d}`] = { cohort: 0, retained: 0, rate: 0 }
      continue
    }

    // チャンク単位で in クエリ (Supabase の in は数百IDまで)
    const retainedSet = new Set<string>()
    for (let i = 0; i < cohortIds.length; i += 200) {
      const chunk = cohortIds.slice(i, i + 200)
      const { data: activity } = await admin
        .from('watchlists')
        .select('user_id')
        .in('user_id', chunk)
        .gte('updated_at', checkAfter)
      for (const a of (activity || []) as { user_id: string }[]) retainedSet.add(a.user_id)
    }

    result[`d${d}`] = {
      cohort: cohortIds.length,
      retained: retainedSet.size,
      rate: cohortIds.length > 0 ? retainedSet.size / cohortIds.length : 0,
    }
  }

  return result
}
