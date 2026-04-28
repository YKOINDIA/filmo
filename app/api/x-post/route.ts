import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabase-admin'
import { isAdminEmail } from '../../lib/adminAuth'

export async function POST(request: NextRequest) {
  try {
    const { text, admin_email } = await request.json()
    if (!isAdminEmail(admin_email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const admin = getSupabaseAdmin()
    await admin.from('x_post_drafts').insert({
      text,
      status: 'draft',
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
