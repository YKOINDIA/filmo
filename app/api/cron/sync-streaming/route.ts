import { NextRequest, NextResponse } from 'next/server'
import { cronGuard } from '../../../lib/cronGuard'
import { createAdminClient, DB_ID, COLLECTIONS, Query, ID } from '../../../lib/appwrite-server'

export async function GET(req: NextRequest) {
  const guard = await cronGuard(req, 'sync-streaming')
  if (guard) return guard

  try {
    const TMDB_API_KEY = process.env.TMDB_API_KEY
    if (!TMDB_API_KEY) return NextResponse.json({ error: 'No TMDB key' }, { status: 500 })

    const { databases } = createAdminClient()

    // 人気映画の配信情報を同期
    const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=ja-JP&region=JP`)
    const data = await res.json()
    let synced = 0

    for (const movie of (data.results || []).slice(0, 20)) {
      try {
        const provRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${TMDB_API_KEY}`)
        const provData = await provRes.json()
        const jp = provData.results?.JP

        if (jp) {
          for (const type of ['flatrate', 'rent', 'buy'] as const) {
            const providers = jp[type] || []
            for (const prov of providers) {
              try {
                // Check if service exists
                const svcRes = await databases.listDocuments(DB_ID, COLLECTIONS.STREAMING_SERVICES, [
                  Query.equal('tmdb_provider_id', prov.provider_id),
                  Query.limit(1),
                ])
                const svcId = svcRes.documents[0]?.$id
                if (!svcId) continue

                // Upsert streaming availability
                const existing = await databases.listDocuments(DB_ID, COLLECTIONS.STREAMING_AVAILABILITY, [
                  Query.equal('movie_id', movie.id),
                  Query.equal('service_id', svcId),
                  Query.equal('availability_type', type),
                  Query.limit(1),
                ])

                if (existing.documents.length === 0) {
                  await databases.createDocument(DB_ID, COLLECTIONS.STREAMING_AVAILABILITY, ID.unique(), {
                    movie_id: movie.id,
                    service_id: svcId,
                    availability_type: type,
                  })
                }
                synced++
              } catch { /* skip individual */ }
            }
          }
        }
      } catch { /* skip movie */ }
    }

    // Cron設定更新
    try {
      const settings = await databases.listDocuments(DB_ID, COLLECTIONS.CRON_SETTINGS, [
        Query.equal('path', 'sync-streaming'),
      ])
      if (settings.documents.length > 0) {
        await databases.updateDocument(DB_ID, COLLECTIONS.CRON_SETTINGS, settings.documents[0].$id, {
          last_run: new Date().toISOString(),
          last_status: `synced ${synced}`,
        })
      }
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, synced })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
