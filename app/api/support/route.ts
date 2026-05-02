import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabase-admin'

/**
 * 匿名問い合わせ API。
 *
 * /support ページからの POST を受けて feedback_threads + feedback_messages に
 * 書き込む。RLS をバイパスするため service-role admin client を使用。
 *
 * 認証不要だが middleware の rate limit で連投は防止される。
 */

interface Body {
  email?: string
  name?: string
  category?: string  // 'feature' | 'bug' | 'question' | 'other'
  subject?: string
  body?: string
}

const VALID_CATEGORIES = new Set(['feature', 'bug', 'question', 'other'])

export async function POST(req: NextRequest) {
  let payload: Body
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = (payload.email || '').trim()
  const name = (payload.name || '').trim() || null
  const category = VALID_CATEGORIES.has(payload.category || '') ? payload.category! : 'other'
  const subject = (payload.subject || '').trim()
  const body = (payload.body || '').trim()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 })
  }
  if (!subject || subject.length < 2) {
    return NextResponse.json({ error: '件名を入力してください' }, { status: 400 })
  }
  if (!body || body.length < 5) {
    return NextResponse.json({ error: '本文を 5 文字以上で入力してください' }, { status: 400 })
  }
  if (subject.length > 200 || body.length > 5000 || email.length > 200) {
    return NextResponse.json({ error: '入力が長すぎます' }, { status: 400 })
  }

  try {
    const admin = getSupabaseAdmin()

    const { data: thread, error: threadErr } = await admin
      .from('feedback_threads')
      .insert({
        user_id: null,
        category,
        subject,
        status: 'open',
        unread_admin: true,
        unread_user: false,
        submitter_email: email,
        submitter_name: name,
      })
      .select('id')
      .single()
    if (threadErr || !thread) {
      console.error('feedback_threads insert failed:', threadErr)
      return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
    }

    const { error: msgErr } = await admin
      .from('feedback_messages')
      .insert({ thread_id: thread.id, body, is_admin: false })
    if (msgErr) {
      console.error('feedback_messages insert failed:', msgErr)
      // thread はできているので一応成功扱い (admin 側で本文不在は分かる)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('support POST error:', err)
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
  }
}
