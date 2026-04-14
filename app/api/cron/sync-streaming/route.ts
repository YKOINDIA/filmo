import { NextRequest, NextResponse } from 'next/server'
import { cronGuard } from '../../../lib/cronGuard'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'

export async function GET(req: NextRequest) {
  const guard = await cronGuard(req, 'sync-streaming')
  if (guard) return guard

  try {
    const TMDB_API_KEY = process.env.TMDB_API_KEY
    if (!TMDB_API_KEY) return NextResponse.json({ error: 'No TMDB key' }, { status: 500 })

    const admin = getSupabaseAdmin()

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
                const { data: svcData } = await admin.from('streaming_services')
                  .select('*')
                  .eq('tmdb_provider_id', prov.provider_id)
                  .limit(1)

                const svcId = svcData?.[0]?.id
                if (!svcId) continue

                // Upsert streaming availability
                const { data: existing } = await admin.from('streaming_availability')
                  .select('*')
                  .eq('movie_id', movie.id)
                  .eq('service_id', svcId)
                  .eq('availability_type', type)
                  .limit(1)

                if (!existing || existing.length === 0) {
                  await admin.from('streaming_availability').insert({
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
      const { data: settings } = await admin.from('cron_settings')
        .select('*')
        .eq('path', 'sync-streaming')

      if (settings && settings.length > 0) {
        await admin.from('cron_settings').update({
          last_run: new Date().toISOString(),
          last_status: `synced ${synced}`,
        }).eq('id', settings[0].id)
      }
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, synced })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
