import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const action = searchParams.get('action')
  const supabase = getSupabaseAdmin()

  try {
    switch (action) {
      // 管理者: 全提案一覧
      case 'list': {
        const status = searchParams.get('status') || 'pending'
        const { data } = await supabase
          .from('edit_proposals')
          .select('*')
          .eq('status', status)
          .order('created_at', { ascending: false })
          .limit(50)
        return NextResponse.json({ proposals: data || [] })
      }

      // 管理者: 作品リクエスト一覧
      case 'work_requests': {
        const status = searchParams.get('status') || 'pending'
        const { data } = await supabase
          .from('work_requests')
          .select('*')
          .eq('status', status)
          .order('created_at', { ascending: false })
          .limit(50)
        return NextResponse.json({ requests: data || [] })
      }

      // 管理者: キャスト提案一覧
      case 'person_proposals': {
        const status = searchParams.get('status') || 'pending'
        const { data } = await supabase
          .from('person_edit_proposals')
          .select('*')
          .eq('status', status)
          .order('created_at', { ascending: false })
          .limit(50)
        return NextResponse.json({ proposals: data || [] })
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
      // ユーザー: 修正提案を送信
      case 'submit': {
        const { userId, movieId, fieldName, currentValue, proposedValue, reason } = body
        if (!userId || !movieId || !fieldName || !proposedValue) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const { data, error } = await supabase.from('edit_proposals').insert({
          user_id: userId,
          movie_id: movieId,
          field_name: fieldName,
          current_value: currentValue || null,
          proposed_value: proposedValue,
          reason: reason || null,
          status: 'pending',
        }).select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ proposal: data })
      }

      // 管理者: 修正提案を承認
      case 'approve': {
        const { proposalId, adminId } = body
        if (!proposalId || !adminId) {
          return NextResponse.json({ error: 'proposalId and adminId required' }, { status: 400 })
        }

        // 提案を取得
        const { data: proposal } = await supabase
          .from('edit_proposals')
          .select('*')
          .eq('id', proposalId)
          .single()

        if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

        // movies テーブルを更新
        const updateData: Record<string, unknown> = {}
        updateData[proposal.field_name] = proposal.proposed_value
        // genres は JSON なのでパース
        if (proposal.field_name === 'genres') {
          try { updateData[proposal.field_name] = JSON.parse(proposal.proposed_value) } catch { /* use as-is */ }
        }

        await supabase.from('movies').update(updateData).eq('id', proposal.movie_id)

        // 提案ステータス更新
        await supabase.from('edit_proposals').update({
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        }).eq('id', proposalId)

        // 貢献ポイント記録
        await supabase.from('data_contributions').insert({
          user_id: proposal.user_id,
          contribution_type: 'edit_proposal',
          reference_id: proposalId,
          movie_id: proposal.movie_id,
          points_awarded: 10,
          status: 'awarded',
        })

        return NextResponse.json({ success: true })
      }

      // 管理者: 修正提案を却下
      case 'reject': {
        const { proposalId, adminId, adminNote } = body
        if (!proposalId || !adminId) {
          return NextResponse.json({ error: 'proposalId and adminId required' }, { status: 400 })
        }

        await supabase.from('edit_proposals').update({
          status: 'rejected',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          admin_note: adminNote || null,
        }).eq('id', proposalId)

        return NextResponse.json({ success: true })
      }

      // 管理者: 作品リクエストを承認
      case 'approve_request': {
        const { requestId, adminId } = body
        if (!requestId || !adminId) {
          return NextResponse.json({ error: 'requestId and adminId required' }, { status: 400 })
        }

        const { data: req } = await supabase
          .from('work_requests')
          .select('*')
          .eq('id', requestId)
          .single()

        if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

        // 負のIDを生成
        const { data: minRow } = await supabase
          .from('movies')
          .select('id')
          .order('id', { ascending: true })
          .limit(1)
          .single()
        const newId = Math.min((minRow?.id || 0) - 1, -1)

        const releaseDate = req.year ? `${req.year}-01-01` : null

        const { data: movie, error } = await supabase.from('movies').insert({
          id: newId,
          tmdb_id: null,
          title: req.title,
          original_title: req.original_title || null,
          overview: req.description || null,
          media_type: req.media_type || 'tv',
          release_date: releaseDate,
          data_source: 'user',
          created_by: req.user_id,
          is_verified: true,
          poster_path: null,
          backdrop_path: null,
          vote_average: 0,
          vote_count: 0,
          genres: [],
          production_countries: [],
          credits: { cast: [], crew: [] },
          cached_at: new Date().toISOString(),
        }).select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // リクエストステータス更新
        await supabase.from('work_requests').update({
          status: 'approved',
          movie_id: movie.id,
          reviewed_by: adminId,
          updated_at: new Date().toISOString(),
        }).eq('id', requestId)

        return NextResponse.json({ success: true, movie })
      }

      // 管理者: 作品リクエストを却下
      case 'reject_request': {
        const { requestId, adminId, adminNote } = body
        if (!requestId || !adminId) {
          return NextResponse.json({ error: 'requestId and adminId required' }, { status: 400 })
        }

        await supabase.from('work_requests').update({
          status: 'rejected',
          reviewed_by: adminId,
          admin_note: adminNote || null,
          updated_at: new Date().toISOString(),
        }).eq('id', requestId)

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
