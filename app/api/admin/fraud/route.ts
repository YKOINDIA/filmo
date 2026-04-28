import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
import { isAdminEmail } from '../../../lib/adminAuth'

/**
 * 管理画面 不正検知エンドポイント。
 *
 * GET /api/admin/fraud?email=admin@... → JSON
 *
 * 検知項目:
 *   massLikers: 過去24h で list_likes を 50件以上したユーザー (botの可能性)
 *   massCommenters: 過去24h で list_comments を 30件以上したユーザー
 *   massFollowers: 過去24h で follows を 50件以上したユーザー
 *   newAccountsBurst: 同IPからの大量登録 (log-ip テーブル参照)
 *   suspiciousReviews: 短文レビューを大量投稿 (1日10件以上 & 平均文字数<20)
 *
 * 100万ユーザー超になったら window 関数 + マテビューで定期計算する PR3 で対応。
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [likersRes, commentersRes, followersRes, reviewsRes, recentBansRes] = await Promise.all([
    admin.from('list_likes').select('user_id').gte('created_at', last24h),
    admin.from('list_comments').select('user_id').gte('created_at', last24h),
    admin.from('follows').select('follower_id').gte('created_at', last24h),
    admin.from('reviews').select('user_id, body, created_at').eq('is_draft', false).gte('created_at', last24h),
    admin.from('users').select('id, email, name, ban_reason, updated_at').eq('is_banned', true).order('updated_at', { ascending: false }).limit(20),
  ])

  // ── massLikers ──
  const likeCount = new Map<string, number>()
  for (const r of (likersRes.data || []) as { user_id: string }[]) {
    likeCount.set(r.user_id, (likeCount.get(r.user_id) || 0) + 1)
  }
  const massLikers = [...likeCount.entries()]
    .filter(([, n]) => n >= 50)
    .sort((a, b) => b[1] - a[1])

  // ── massCommenters ──
  const commentCount = new Map<string, number>()
  for (const r of (commentersRes.data || []) as { user_id: string }[]) {
    commentCount.set(r.user_id, (commentCount.get(r.user_id) || 0) + 1)
  }
  const massCommenters = [...commentCount.entries()]
    .filter(([, n]) => n >= 30)
    .sort((a, b) => b[1] - a[1])

  // ── massFollowers ──
  const followCount = new Map<string, number>()
  for (const r of (followersRes.data || []) as { follower_id: string }[]) {
    followCount.set(r.follower_id, (followCount.get(r.follower_id) || 0) + 1)
  }
  const massFollowers = [...followCount.entries()]
    .filter(([, n]) => n >= 50)
    .sort((a, b) => b[1] - a[1])

  // ── suspiciousReviews ──
  const reviewStats = new Map<string, { count: number; totalLen: number }>()
  for (const r of (reviewsRes.data || []) as { user_id: string; body: string }[]) {
    const cur = reviewStats.get(r.user_id) || { count: 0, totalLen: 0 }
    cur.count++
    cur.totalLen += (r.body || '').length
    reviewStats.set(r.user_id, cur)
  }
  const suspiciousReviews = [...reviewStats.entries()]
    .filter(([, s]) => s.count >= 10 && s.totalLen / s.count < 20)
    .map(([uid, s]) => [uid, s.count, Math.round(s.totalLen / s.count)] as const)
    .sort((a, b) => b[1] - a[1])

  // ── 関連ユーザー名 fetch ──
  const allUserIds = new Set<string>()
  for (const [uid] of [...massLikers, ...massCommenters, ...massFollowers]) allUserIds.add(uid)
  for (const [uid] of suspiciousReviews) allUserIds.add(uid)

  const userMap = new Map<string, { name: string; email: string }>()
  if (allUserIds.size > 0) {
    const { data: usersData } = await admin
      .from('users')
      .select('id, name, email')
      .in('id', [...allUserIds])
    for (const u of (usersData || []) as { id: string; name: string; email: string }[]) {
      userMap.set(u.id, { name: u.name, email: u.email })
    }
  }

  const enrich = <T extends readonly [string, ...unknown[]]>(items: T[]) =>
    items.slice(0, 20).map(it => ({
      userId: it[0],
      name: userMap.get(it[0])?.name || '?',
      email: userMap.get(it[0])?.email || '?',
      counts: it.slice(1),
    }))

  return NextResponse.json({
    massLikers: enrich(massLikers),
    massCommenters: enrich(massCommenters),
    massFollowers: enrich(massFollowers),
    suspiciousReviews: enrich(suspiciousReviews),
    recentBans: recentBansRes.data ?? [],
    generatedAt: new Date().toISOString(),
  })
}
