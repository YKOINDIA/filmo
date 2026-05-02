import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'

/**
 * UGC 通報 API。
 *
 * App Store 審査ガイドライン 1.2 で必須の不適切コンテンツ通報機能。
 * レビュー・リスト・ユーザープロフィールを通報できる。
 *
 * 認証必須 (Bearer token)。RLS は auth.uid() = reporter_id でチェックされる。
 */

const VALID_TARGET_TYPES = new Set(['review', 'list', 'user'])
const VALID_REASONS = new Set(['spam', 'harassment', 'inappropriate', 'copyright', 'other'])

interface Body {
  targetType?: string
  targetId?: string
  reason?: string
  detail?: string
}

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

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  let payload: Body
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetType = (payload.targetType || '').trim()
  const targetId = (payload.targetId || '').trim()
  const reason = (payload.reason || '').trim()
  const detail = (payload.detail || '').trim().slice(0, 1000) || null

  if (!VALID_TARGET_TYPES.has(targetType)) {
    return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 })
  }
  if (!targetId) {
    return NextResponse.json({ error: 'targetId required' }, { status: 400 })
  }
  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
  }

  // 自分自身を通報するケースは弾く（user タイプのみ意味あり）
  if (targetType === 'user' && targetId === user.id) {
    return NextResponse.json({ error: '自分自身は通報できません' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // 重複通報のチェック (status='pending' のみ UNIQUE)
  const { data: existing } = await admin
    .from('content_reports')
    .select('id')
    .eq('reporter_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, alreadyReported: true })
  }

  const { error } = await admin
    .from('content_reports')
    .insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      detail,
      status: 'pending',
    })

  if (error) {
    console.error('content_reports insert failed:', error)
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
  }

  // 管理者アラート (admin_alerts に通知)
  await admin
    .from('admin_alerts')
    .insert({
      type: 'content_report',
      severity: 'warning',
      detail: { target_type: targetType, target_id: targetId, reason, reporter_id: user.id },
    })
    .then(() => undefined, () => undefined)

  return NextResponse.json({ ok: true })
}
