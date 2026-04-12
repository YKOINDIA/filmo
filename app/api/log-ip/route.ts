import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, DB_ID, COLLECTIONS, ID } from '../../lib/appwrite-server'

export async function POST(request: NextRequest) {
  try {
    const { user_id, action } = await request.json()
    const { databases } = createAdminClient()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               request.headers.get('x-real-ip') || 'unknown'

    await databases.createDocument(DB_ID, COLLECTIONS.ACCESS_LOGS, ID.unique(), {
      user_id: user_id || null,
      ip_hint: ip.substring(0, 20),
      action: action || 'page_view',
      user_agent: request.headers.get('user-agent')?.substring(0, 200) || '',
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
