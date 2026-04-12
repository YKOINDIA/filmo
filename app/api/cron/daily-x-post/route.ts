import { NextRequest, NextResponse } from 'next/server'
import { cronGuard } from '../../../lib/cronGuard'
import { createAdminClient, DB_ID, COLLECTIONS, Query, ID } from '../../../lib/appwrite-server'

export async function GET(req: NextRequest) {
  const guard = await cronGuard(req, 'daily-x-post')
  if (guard) return guard

  try {
    const TMDB_API_KEY = process.env.TMDB_API_KEY
    if (!TMDB_API_KEY) return NextResponse.json({ error: 'No TMDB key' }, { status: 500 })

    // トレンド映画取得
    const res = await fetch(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}&language=ja-JP`)
    const data = await res.json()
    const top3 = (data.results || []).slice(0, 3)

    const text = `🎬 本日のトレンド映画\n\n${top3.map((m: { title: string; vote_average: number }, i: number) =>
      `${i + 1}. ${m.title} ⭐${m.vote_average.toFixed(1)}`
    ).join('\n')}\n\n#Filmo #映画 #映画レビュー`

    const { databases } = createAdminClient()
    await databases.createDocument(DB_ID, COLLECTIONS.X_POST_DRAFTS, ID.unique(), {
      text,
      status: 'posted',
      posted_at: new Date().toISOString(),
    })

    // Cron設定更新
    try {
      const settings = await databases.listDocuments(DB_ID, COLLECTIONS.CRON_SETTINGS, [
        Query.equal('path', 'daily-x-post'),
      ])
      if (settings.documents.length > 0) {
        await databases.updateDocument(DB_ID, COLLECTIONS.CRON_SETTINGS, settings.documents[0].$id, {
          last_run: new Date().toISOString(),
          last_status: 'ok',
        })
      }
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, text })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
