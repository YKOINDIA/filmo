import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabase-admin'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'ykoindia@gmail.com'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, body: announcementBody, type, send_push, send_email, admin_email } = body

    if (admin_email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const admin = getSupabaseAdmin()

    // お知らせ作成
    const { data: announcement, error: annErr } = await admin.from('announcements').insert({
      title,
      body: announcementBody,
      type: type || 'info',
      send_push: send_push || false,
      send_email: send_email || false,
      recipient_count: 0,
    }).select().single()

    if (annErr || !announcement) {
      throw new Error(annErr?.message || 'Failed to create announcement')
    }

    // 全ユーザーに通知
    const { data: users } = await admin.from('users').select('id').limit(5000)
    let count = 0
    for (const user of (users || [])) {
      try {
        await admin.from('user_notifications').insert({
          user_id: user.id,
          announcement_id: announcement.id,
          is_read: false,
        })
        count++
      } catch { /* skip */ }
    }

    await admin.from('announcements').update({
      recipient_count: count,
    }).eq('id', announcement.id)

    return NextResponse.json({ ok: true, recipient_count: count })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
