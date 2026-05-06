import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'

/**
 * アカウント完全削除 API。
 *
 * App Store 審査ガイドライン 5.1.1(v) でアカウント削除機能が必須。
 *
 * 流れ:
 *   1. Bearer トークンで認証
 *   2. service-role で auth.users から該当ユーザーを削除
 *      - users テーブル等の外部キー (ON DELETE CASCADE) で UGC が連鎖削除される
 *   3. クライアント側は signOut() してリロード
 *
 * 注意: クライアント側の supabase.from('users').delete() だけだと
 * auth.users 行が残り、メールアドレスが再利用不可になる。
 * 完全削除には service-role での auth.admin.deleteUser() が必要。
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

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  // 1. Storage 上のアバター・音声レビュー等のオブジェクトは ON DELETE CASCADE で
  //    DB レコードは消えるが、Storage 自体には残る。
  //    voice-reviews / avatars バケットを user_id プレフィックスで一括削除する。
  for (const bucket of ['voice-reviews', 'avatars']) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 })
      if (files && files.length > 0) {
        const paths = files.map(f => `${user.id}/${f.name}`)
        await admin.storage.from(bucket).remove(paths)
      }
    } catch (e) {
      // バケット不在等は無視 (ログだけ残す)
      console.warn(`Storage cleanup failed for bucket ${bucket}:`, e)
    }
  }

  // 2. auth.users を削除 → public.users 等の外部キー (ON DELETE CASCADE) で
  //    reviews / watchlists / user_lists / follows / likes / content_reports /
  //    user_blocks 等の関連レコードがすべて連鎖削除される。
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('auth.admin.deleteUser failed:', error)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
