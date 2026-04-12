import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, DB_ID, COLLECTIONS, Query, ID } from '../../lib/appwrite-server'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'ykoindia@gmail.com'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, body: announcementBody, type, send_push, send_email, admin_email } = body

    if (admin_email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { databases } = createAdminClient()

    // お知らせ作成
    const announcement = await databases.createDocument(DB_ID, COLLECTIONS.ANNOUNCEMENTS, ID.unique(), {
      title,
      body: announcementBody,
      type: type || 'info',
      send_push: send_push || false,
      send_email: send_email || false,
      recipient_count: 0,
    })

    // 全ユーザーに通知
    const users = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [Query.limit(5000)])
    let count = 0
    for (const user of users.documents) {
      try {
        await databases.createDocument(DB_ID, COLLECTIONS.USER_NOTIFICATIONS, ID.unique(), {
          user_id: user.$id,
          announcement_id: announcement.$id,
          is_read: false,
        })
        count++
      } catch { /* skip */ }
    }

    await databases.updateDocument(DB_ID, COLLECTIONS.ANNOUNCEMENTS, announcement.$id, {
      recipient_count: count,
    })

    return NextResponse.json({ ok: true, recipient_count: count })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
