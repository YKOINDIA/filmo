import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
import { isAdminEmail } from '../../../lib/adminAuth'

/**
 * 管理画面 User 検索 + 詳細エンドポイント。
 *
 * GET /api/admin/users?email=admin@...&q=foo&filter=banned&page=0
 *   → ユーザー一覧 (50件/page)
 *
 * GET /api/admin/users?email=admin@...&id=USER_UUID
 *   → 詳細 (プロフィール + 統計 + 最近の活動)
 *
 * POST /api/admin/users (action=ban|unban|warn, email=admin, userId, reason)
 *   → ban/unban/warn 実行
 */

async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const email = req.nextUrl.searchParams.get('email')
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const authErr = await authorize(req)
  if (authErr) return authErr

  const admin = getSupabaseAdmin()
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    // 詳細
    const { data: user, error } = await admin
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const [watchedCount, reviewCount, listCount, listLikeCount, followingCount, followersCount, recentActivity] = await Promise.all([
      admin.from('watchlists').select('*', { count: 'exact', head: true }).eq('user_id', id).eq('status', 'watched'),
      admin.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', id).eq('is_draft', false),
      admin.from('user_lists').select('*', { count: 'exact', head: true }).eq('user_id', id),
      admin.from('list_likes').select('*', { count: 'exact', head: true }).eq('user_id', id),
      admin.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
      admin.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
      admin.from('reviews').select('id, movie_id, body, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    ])

    return NextResponse.json({
      user,
      stats: {
        watched: watchedCount.count ?? 0,
        reviews: reviewCount.count ?? 0,
        lists: listCount.count ?? 0,
        listLikes: listLikeCount.count ?? 0,
        following: followingCount.count ?? 0,
        followers: followersCount.count ?? 0,
      },
      recentReviews: recentActivity.data ?? [],
    })
  }

  // 一覧 (search + filter)
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const filter = req.nextUrl.searchParams.get('filter') || 'all'
  const page = parseInt(req.nextUrl.searchParams.get('page') || '0', 10)
  const PAGE_SIZE = 50

  let query = admin
    .from('users')
    .select('id, email, name, avatar_url, level, points, is_banned, ban_reason, created_at, country, birth_year', { count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000001')

  if (filter === 'banned') {
    query = query.eq('is_banned', true)
  } else if (filter === 'active') {
    // 過去30日に活動あり
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', last30)
  }

  if (q) {
    // email / name / id (部分一致)
    query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,id.eq.${q.match(/^[0-9a-f-]{36}$/i) ? q : '00000000-0000-0000-0000-000000000000'}`)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    users: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  })
}

export async function POST(req: NextRequest) {
  let body: { email?: string; action?: string; userId?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isAdminEmail(body.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { action, userId, reason } = body

  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  if (action === 'ban') {
    const { error } = await admin.from('users').update({
      is_banned: true,
      ban_reason: reason || '違反行為',
    }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, message: 'BANしました' })
  }

  if (action === 'unban') {
    const { error } = await admin.from('users').update({
      is_banned: false,
      ban_reason: null,
    }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, message: 'BAN解除しました' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
