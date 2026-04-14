import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabase-admin'

export async function GET() {
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin.from('x_post_drafts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    return NextResponse.json({ data: data || [] })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const admin = getSupabaseAdmin()
    await admin.from('x_post_drafts').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
