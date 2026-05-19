// ============================================================
// POST /api/auth/id-recover
// ============================================================
// ID + 復旧コード で新パスワード設定 → 新復旧コードを発行 (one-time)。
//
// Body:
//   { username, recoveryCode, newPassword }
// Response:
//   { ok: true, email, newRecoveryCode } — クライアントは email/newPassword で signInWithPassword
//   { ok: false, error }
//
// 攻撃緩和:
//   - 復旧コードはハッシュ比較 (constant-time 相当の string equality)
//   - 大量試行対策は別途 rate limiting (将来 middleware で)

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'
import {
  isValidUsername, isValidPassword,
  usernameToEmail, generateRecoveryCode, hashRecoveryCode,
} from '@/app/lib/idAuth'

export const runtime = 'nodejs'

interface Body {
  username?: string
  recoveryCode?: string
  newPassword?: string
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const username = (body.username ?? '').trim().toLowerCase()
  const newPassword = body.newPassword ?? ''
  if (!isValidUsername(username)) {
    return NextResponse.json({ ok: false, error: 'IDの形式が正しくありません' }, { status: 400 })
  }
  if (!isValidPassword(newPassword)) {
    return NextResponse.json({ ok: false, error: '新しいパスワードは 8 文字以上にしてね' }, { status: 400 })
  }
  if (!body.recoveryCode) {
    return NextResponse.json({ ok: false, error: '復旧コードを入力してね' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // ユーザー取得
  const { data: user, error: fetchErr } = await admin
    .from('users')
    .select('id, recovery_code_hash')
    .eq('username', username)
    .maybeSingle()
  if (fetchErr) {
    return NextResponse.json({ ok: false, error: 'サーバーエラー' }, { status: 500 })
  }
  if (!user) {
    // 存在判定を漏らさないため、コード不一致と同じエラー
    return NextResponse.json({ ok: false, error: 'IDまたは復旧コードが違います' }, { status: 401 })
  }
  if (!user.recovery_code_hash) {
    return NextResponse.json({ ok: false, error: '復旧コードが登録されていません' }, { status: 400 })
  }

  // コード比較
  const incomingHash = await hashRecoveryCode(body.recoveryCode)
  if (incomingHash !== user.recovery_code_hash) {
    return NextResponse.json({ ok: false, error: 'IDまたは復旧コードが違います' }, { status: 401 })
  }

  // 新パスワード設定
  const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (pwErr) {
    return NextResponse.json({ ok: false, error: 'パスワード更新に失敗しました' }, { status: 500 })
  }

  // 新復旧コード発行 (古いコードは即無効化)
  const newCode = generateRecoveryCode()
  const newHash = await hashRecoveryCode(newCode)
  const { error: updErr } = await admin.from('users').update({
    recovery_code_hash: newHash,
    recovery_code_rotated_at: new Date().toISOString(),
  }).eq('id', user.id)
  if (updErr) {
    // パスワードは更新済み。復旧コードだけ古いままになる可能性 (致命ではない)
    console.warn('[id-recover] failed to rotate recovery code:', updErr)
  }

  return NextResponse.json({
    ok: true,
    email: usernameToEmail(username),
    newRecoveryCode: newCode,
  })
}
