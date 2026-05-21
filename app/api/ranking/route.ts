import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabase-admin'

// ランキングは秒単位で更新される必要はないので、Vercel Edge で 2 分キャッシュ
// + 5 分 SWR。これで同一 type の連続リクエストが Function 経由しなくなる。
const RANKING_CACHE = 'public, s-maxage=120, stale-while-revalidate=300'

function ok(body: unknown) {
  const res = NextResponse.json(body)
  res.headers.set('Cache-Control', RANKING_CACHE)
  return res
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'watches'

  try {
    const admin = getSupabaseAdmin()

    switch (type) {
      case 'points': {
        const { data } = await admin.from('users')
          .select('*')
          .order('points', { ascending: false })
          .limit(50)
        return ok((data || []).map((d, i) => ({
          rank: i + 1,
          userId: d.id,
          name: d.name,
          avatar_url: d.avatar_url,
          value: d.points,
        })))
      }
      case 'streak': {
        const { data } = await admin.from('users')
          .select('*')
          .order('login_streak', { ascending: false })
          .limit(50)
        return ok((data || []).map((d, i) => ({
          rank: i + 1,
          userId: d.id,
          name: d.name,
          avatar_url: d.avatar_url,
          value: d.login_streak,
        })))
      }
      case 'watches': {
        const { data } = await admin.from('users')
          .select('*')
          .order('points', { ascending: false })
          .limit(50)
        // For watches, we'd need to count per user - simplified for now
        return ok((data || []).map((d, i) => ({
          rank: i + 1,
          userId: d.id,
          name: d.name,
          avatar_url: d.avatar_url,
          value: d.points,
        })))
      }
      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
