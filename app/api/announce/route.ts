import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabase-admin'
import { isAdminEmail } from '../../lib/adminAuth'

interface SegmentFilter {
  country?: string         // ISO 2-letter
  birthDecade?: string     // '90s', '80s', etc.
  gender?: string          // 'male' | 'female' | 'other' | 'prefer_not_to_say'
  minLevel?: number
  signupAfter?: string     // ISO date — このcohort以降
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, body: announcementBody, type, send_push, send_email, admin_email, segment } = body as {
      title?: string; body?: string; type?: string;
      send_push?: boolean; send_email?: boolean;
      admin_email?: string; segment?: SegmentFilter
    }

    if (!isAdminEmail(admin_email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!title || !announcementBody) {
      return NextResponse.json({ error: 'title と body は必須です' }, { status: 400 })
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
      segment_filter: segment || null,
    }).select().single()

    if (annErr || !announcement) {
      throw new Error(annErr?.message || 'Failed to create announcement')
    }

    // 対象ユーザー絞り込み (セグメント条件)
    let q = admin.from('users').select('id').neq('id', '00000000-0000-0000-0000-000000000001')
    if (segment?.country) q = q.eq('country', segment.country)
    if (segment?.gender) q = q.eq('gender', segment.gender)
    if (segment?.minLevel != null) q = q.gte('level', segment.minLevel)
    if (segment?.birthDecade) {
      // '90s' → birth_year BETWEEN 1990 AND 1999
      const m = segment.birthDecade.match(/^(\d+)s$/)
      if (m) {
        const decadeStart = parseInt(m[1], 10)
        const start = decadeStart < 30 ? 2000 + decadeStart : 1900 + decadeStart // '90s'=1990, '00s'=2000
        q = q.gte('birth_year', start).lte('birth_year', start + 9)
      }
    }
    if (segment?.signupAfter) q = q.gte('created_at', segment.signupAfter)

    // 上限 50000 (一括 INSERT のメモリ + RLS 影響)
    const { data: targetUsers } = await q.limit(50000)
    const userIds = ((targetUsers || []) as { id: string }[]).map(u => u.id)

    // チャンク INSERT (Supabase の payload size 限界対策)
    let count = 0
    const CHUNK = 500
    for (let i = 0; i < userIds.length; i += CHUNK) {
      const slice = userIds.slice(i, i + CHUNK)
      const rows = slice.map(uid => ({
        user_id: uid,
        announcement_id: announcement.id,
        is_read: false,
      }))
      const { error: notifErr } = await admin.from('user_notifications').insert(rows)
      if (!notifErr) count += slice.length
    }

    await admin.from('announcements').update({
      recipient_count: count,
    }).eq('id', announcement.id)

    return NextResponse.json({ ok: true, recipient_count: count, total_targeted: userIds.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
