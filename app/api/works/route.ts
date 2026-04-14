import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

// ユーザー認証を取得
async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  return user
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const action = searchParams.get('action')
  const supabase = getSupabaseAdmin()

  try {
    switch (action) {
      // ローカルDB内のユーザー登録作品を検索
      case 'search_local': {
        const query = searchParams.get('query') || ''
        if (!query.trim()) return NextResponse.json({ results: [] })

        const { data } = await supabase
          .from('movies')
          .select('id, title, original_title, media_type, release_date, poster_path, vote_average, data_source, is_verified')
          .or(`title.ilike.%${query}%,original_title.ilike.%${query}%`)
          .eq('data_source', 'user')
          .is('merged_into', null)
          .order('created_at', { ascending: false })
          .limit(20)

        return NextResponse.json({ results: data || [] })
      }

      // ユーザーの作品リクエスト一覧
      case 'my_requests': {
        const userId = searchParams.get('user_id')
        if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

        const { data } = await supabase
          .from('work_requests')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)

        return NextResponse.json({ requests: data || [] })
      }

      // ユーザーのデータ貢献一覧
      case 'my_contributions': {
        const userId = searchParams.get('user_id')
        if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

        const { data } = await supabase
          .from('data_contributions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)

        return NextResponse.json({ contributions: data || [] })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action } = body
  const supabase = getSupabaseAdmin()

  try {
    switch (action) {
      // 簡易登録: ユーザーが作品をタイトルだけで登録
      case 'register': {
        const { userId, title, originalTitle, mediaType, year, description } = body
        if (!userId || !title) {
          return NextResponse.json({ error: 'userId and title required' }, { status: 400 })
        }

        // 重複チェック: title / original_title の両方で、全データソースを横断検索
        const trimmed = title.trim()
        const { data: existing } = await supabase
          .from('movies')
          .select('id, title, original_title, media_type, release_date, data_source')
          .or(`title.ilike.${trimmed},original_title.ilike.${trimmed}`)
          .is('merged_into', null)
          .limit(10)

        if (existing && existing.length > 0) {
          return NextResponse.json({
            duplicates: existing,
            message: '同じタイトルの作品が既に登録されています。該当作品がないか確認してください。',
          }, { status: 409 })
        }

        // 負のIDを生成（既存の最小IDから-1）
        const { data: minRow } = await supabase
          .from('movies')
          .select('id')
          .order('id', { ascending: true })
          .limit(1)
          .single()
        const newId = Math.min((minRow?.id || 0) - 1, -1)

        // release_date を年から組み立て
        const releaseDate = year ? `${year}-01-01` : null

        const { data: inserted, error } = await supabase.from('movies').insert({
          id: newId,
          tmdb_id: null,
          title: title.trim(),
          original_title: originalTitle?.trim() || null,
          overview: description?.trim() || null,
          media_type: mediaType || 'tv',
          release_date: releaseDate,
          data_source: 'user',
          created_by: userId,
          is_verified: false,
          poster_path: null,
          backdrop_path: null,
          vote_average: 0,
          vote_count: 0,
          genres: [],
          production_countries: [],
          credits: { cast: [], crew: [] },
          cached_at: new Date().toISOString(),
        }).select().single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ work: inserted })
      }

      // リクエスト: 管理者に追加を依頼
      case 'request': {
        const { userId, title, originalTitle, mediaType, year, description } = body
        if (!userId || !title) {
          return NextResponse.json({ error: 'userId and title required' }, { status: 400 })
        }

        const { data: req, error } = await supabase.from('work_requests').insert({
          user_id: userId,
          title: title.trim(),
          original_title: originalTitle?.trim() || null,
          media_type: mediaType || 'tv',
          year: year || null,
          description: description?.trim() || null,
          status: 'pending',
        }).select().single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ request: req })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
