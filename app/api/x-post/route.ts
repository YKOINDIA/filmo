import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, DB_ID, COLLECTIONS, ID } from '../../lib/appwrite-server'

export async function POST(request: NextRequest) {
  try {
    const { text, admin_email } = await request.json()
    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'ykoindia@gmail.com'
    if (admin_email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { databases } = createAdminClient()
    await databases.createDocument(DB_ID, COLLECTIONS.X_POST_DRAFTS, ID.unique(), {
      text,
      status: 'draft',
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
