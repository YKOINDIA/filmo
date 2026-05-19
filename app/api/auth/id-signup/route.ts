// ============================================================
// POST /api/auth/id-signup
// ============================================================
// ID + パスワード で新規登録。
//   1. username バリデーション (形式 / 予約語)
//   2. 既存 username との衝突チェック
//   3. supabase-admin.auth.admin.createUser で合成メール + パスワード作成
//      (email_confirm: true で確認スキップ)
//   4. 復旧コード生成 → ハッシュを users に保存、平文は 1 回だけ返す
//   5. users 行に username 等を upsert
//
// 戻り値:
//   { ok: true, recoveryCode, userId } 成功時
//   { ok: false, error: '...' }       エラー時 (4xx)

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'
import {
  isValidUsername, isReservedUsername, isValidPassword,
  usernameToEmail, generateRecoveryCode, hashRecoveryCode,
} from '@/app/lib/idAuth'

export const runtime = 'nodejs'

interface Body {
  username?: string
  password?: string
  nickname?: string
  agreedToTerms?: boolean
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const username = (body.username ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const nickname = (body.nickname ?? '').trim().slice(0, 30) || username

  // バリデーション
  if (!body.agreedToTerms) {
    return NextResponse.json({ ok: false, error: '利用規約・プライバシーポリシーへの同意が必要です' }, { status: 400 })
  }
  if (!isValidUsername(username)) {
    return NextResponse.json({ ok: false, error: 'IDは半角小文字英数字とアンダースコア (_) で 4〜20 文字' }, { status: 400 })
  }
  if (isReservedUsername(username)) {
    return NextResponse.json({ ok: false, error: 'そのIDは使えません (予約語)' }, { status: 400 })
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ ok: false, error: 'パスワードは 8 文字以上にしてね' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // 既存衝突チェック (username UNIQUE があるが、わかりやすいエラーを返すため事前確認)
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: false, error: 'そのIDは既に使われています' }, { status: 409 })
  }

  const email = usernameToEmail(username)

  // 合成メール側の衝突も念のため (theoretically caught by Supabase Auth too)
  // → admin.createUser が 422 を返す

  // Supabase Auth で作成 (email_confirm: true で確認スキップ)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: nickname, signup_method: 'id' },
  })
  if (createErr || !created.user) {
    // 既に同 email が居る場合は 422
    const msg = createErr?.message ?? 'アカウント作成に失敗しました'
    const status = msg.includes('already') || msg.includes('exists') ? 409 : 500
    return NextResponse.json({
      ok: false,
      error: status === 409 ? 'そのIDは既に使われています' : msg,
    }, { status })
  }
  const userId = created.user.id

  // 復旧コード生成
  const recoveryCode = generateRecoveryCode()
  const codeHash = await hashRecoveryCode(recoveryCode)

  // users 行を upsert (handle_new_user trigger があれば既に作られているが、
  // username / recovery_code_hash は app から書く必要がある)
  const { error: upsertErr } = await admin.from('users').upsert({
    id: userId,
    email,
    username,
    name: nickname,
    recovery_code_hash: codeHash,
    recovery_code_rotated_at: new Date().toISOString(),
    level: 1,
    points: 0,
    login_streak: 0,
    bio: '',
  }, { onConflict: 'id' })
  if (upsertErr) {
    // 致命: 作成した auth user を取り消す (best-effort)
    await admin.auth.admin.deleteUser(userId).catch(() => { /* ignore */ })
    return NextResponse.json({ ok: false, error: 'プロフィール作成に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    userId,
    email,         // クライアントが signInWithPassword に使う
    recoveryCode,  // 1 度だけ返す (UI 側で確実に表示してから廃棄)
  })
}
