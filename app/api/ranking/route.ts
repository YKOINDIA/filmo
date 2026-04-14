import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabase-admin'

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
        return NextResponse.json((data || []).map((d, i) => ({
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
        return NextResponse.json((data || []).map((d, i) => ({
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
        return NextResponse.json((data || []).map((d, i) => ({
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
