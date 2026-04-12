import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, DB_ID, COLLECTIONS } from './appwrite-server'

export async function cronGuard(req: NextRequest, cronPath: string): Promise<NextResponse | null> {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { databases } = createAdminClient()
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.CRON_SETTINGS, [])
    const setting = res.documents.find(d => d.path === cronPath)
    if (setting && !setting.enabled) {
      return NextResponse.json({ skipped: true, reason: 'disabled' })
    }
  } catch { /* allow if no settings */ }

  return null
}
