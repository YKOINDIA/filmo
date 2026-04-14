import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from './supabase-admin'

export async function cronGuard(req: NextRequest, cronPath: string): Promise<NextResponse | null> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('cron_settings')
      .select('path, enabled')
      .eq('path', cronPath)
      .maybeSingle()
    if (data && !data.enabled) {
      return NextResponse.json({ skipped: true, reason: 'disabled' })
    }
  } catch { /* allow if no settings */ }

  return null
}
