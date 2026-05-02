import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'

/**
 * ユーザーブロック API。
 *
 * App Store 審査ガイドライン 1.2 で必須のブロック機能。
 *
 * GET    /api/blocks                — 自分がブロックしているユーザーID一覧
 * POST   /api/blocks { blockedId }  — ブロック
 * DELETE /api/blocks?blockedId=xxx  — ブロック解除
 */

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  return user
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('user_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('user_blocks select failed:', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ blocks: data || [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  let body: { blockedId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const blockedId = (body.blockedId || '').trim()
  if (!blockedId) {
    return NextResponse.json({ error: 'blockedId required' }, { status: 400 })
  }
  if (blockedId === user.id) {
    return NextResponse.json({ error: '自分自身はブロックできません' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // 相互フォローを解除（ブロック相手とのフォロー関係はクリーンアップ）
  await admin
    .from('follows')
    .delete()
    .or(
      `and(follower_id.eq.${user.id},following_id.eq.${blockedId}),` +
      `and(follower_id.eq.${blockedId},following_id.eq.${user.id})`,
    )
    .then(() => undefined, () => undefined)

  const { error } = await admin
    .from('user_blocks')
    .insert({ blocker_id: user.id, blocked_id: blockedId })

  if (error) {
    // UNIQUE 制約違反 = すでにブロック済み（冪等にする）
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, alreadyBlocked: true })
    }
    console.error('user_blocks insert failed:', error)
    return NextResponse.json({ error: 'ブロックに失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const blockedId = request.nextUrl.searchParams.get('blockedId')?.trim()
  if (!blockedId) {
    return NextResponse.json({ error: 'blockedId required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('user_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId)

  if (error) {
    console.error('user_blocks delete failed:', error)
    return NextResponse.json({ error: '解除に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
