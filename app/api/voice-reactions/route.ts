import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { voiceReviewId, soundType } = await req.json()

    if (!voiceReviewId || !['clap', 'laugh', 'replay'].includes(soundType)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { error } = await admin.from('voice_reactions').insert({
      voice_review_id: voiceReviewId,
      sound_type: soundType,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
