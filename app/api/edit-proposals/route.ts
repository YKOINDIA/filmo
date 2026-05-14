import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'
import { isAdminEmail } from '@/app/lib/adminAuth'

// 人物編集提案で受理する field のホワイトリスト。
// profile_path / known_for などはユーザー編集を許さない (TMDB cache が上書きするため)。
const PERSON_EDITABLE_FIELDS = new Set([
  'name', 'original_name', 'biography', 'birthday',
  'place_of_birth', 'homepage',
])

interface PersonChange {
  field_name: string
  current_value: string | null
  proposed_value: string
}

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await client.auth.getUser(authHeader.replace('Bearer ', ''))
  return user
}

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

      // ────────────────────────────────────────────────────────────────
      // 人物編集提案 (Bearer 認証必須 — 既存 work actions より厳しめ)
      // ────────────────────────────────────────────────────────────────

      // ユーザー: 人物編集提案を送信。複数フィールドを 1 提案にまとめる。
      case 'person_submit': {
        const user = await getAuthUser(request)
        if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

        const { personId, changes, reason } = body as { personId?: number; changes?: PersonChange[]; reason?: string }
        if (!personId || !Array.isArray(changes) || changes.length === 0) {
          return NextResponse.json({ error: 'personId と changes が必要です' }, { status: 400 })
        }

        // フィールドホワイトリスト + 文字数制限
        const cleaned: PersonChange[] = []
        for (const c of changes) {
          if (!PERSON_EDITABLE_FIELDS.has(c.field_name)) continue
          const proposed = (c.proposed_value || '').trim()
          if (!proposed) continue
          if (proposed.length > 3000) {
            return NextResponse.json({ error: `${c.field_name} は 3000 文字以内にしてください` }, { status: 400 })
          }
          if (proposed === (c.current_value || '').trim()) continue
          cleaned.push({
            field_name: c.field_name,
            current_value: c.current_value || null,
            proposed_value: proposed,
          })
        }
        if (cleaned.length === 0) {
          return NextResponse.json({ error: '変更点がありません' }, { status: 400 })
        }

        // 対象人物の存在確認 (RLS 影響なしの service-role 読み)
        const { data: target } = await supabase
          .from('persons')
          .select('id, data_source')
          .eq('id', personId)
          .single()
        if (!target) return NextResponse.json({ error: '人物が見つかりません' }, { status: 404 })

        const { data, error } = await supabase
          .from('person_edit_proposals')
          .insert({
            user_id: user.id,
            person_id: personId,
            proposal_type: 'edit_person',
            proposed_data: { changes: cleaned },
            reason: reason ? String(reason).slice(0, 1000) : null,
            status: 'pending',
          })
          .select()
          .single()

        if (error) {
          console.error('person_edit_proposal insert failed:', error)
          return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 })
        }
        return NextResponse.json({ proposal: data })
      }

      // 管理者: 人物編集提案を承認 (persons に反映 + ポイント加算)
      case 'person_approve': {
        const user = await getAuthUser(request)
        if (!user || !isAdminEmail(user.email)) {
          return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
        }

        const { proposalId, adminNote } = body
        if (!proposalId) {
          return NextResponse.json({ error: 'proposalId required' }, { status: 400 })
        }

        const { data: proposal } = await supabase
          .from('person_edit_proposals')
          .select('*')
          .eq('id', proposalId)
          .single()
        if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
        if (proposal.status !== 'pending') {
          return NextResponse.json({ error: 'この提案は既に処理済みです' }, { status: 409 })
        }
        if (proposal.proposal_type !== 'edit_person' || !proposal.person_id) {
          return NextResponse.json({ error: '対応していない proposal_type です' }, { status: 400 })
        }

        // proposed_data.changes から persons の UPDATE データを組み立て
        const changes = (proposal.proposed_data?.changes || []) as PersonChange[]
        const updateData: Record<string, unknown> = {}
        for (const c of changes) {
          if (!PERSON_EDITABLE_FIELDS.has(c.field_name)) continue
          updateData[c.field_name] = c.proposed_value
        }
        if (Object.keys(updateData).length === 0) {
          return NextResponse.json({ error: '反映できる変更がありません' }, { status: 400 })
        }

        const { error: updErr } = await supabase
          .from('persons')
          .update(updateData)
          .eq('id', proposal.person_id)
        if (updErr) {
          console.error('persons update failed:', updErr)
          return NextResponse.json({ error: '反映に失敗しました' }, { status: 500 })
        }

        await supabase
          .from('person_edit_proposals')
          .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            admin_note: adminNote || null,
          })
          .eq('id', proposalId)

        // ポイントを users.points に直接加算 + data_contributions に記録。
        // 既存の awardContributionPoints はクライアント側ヘルパなので
        // ここではサーバから直接適用。
        const POINTS = 10
        try {
          await supabase.from('data_contributions').insert({
            user_id: proposal.user_id,
            contribution_type: 'edit_proposal',
            reference_id: proposalId,
            person_id: proposal.person_id,
            points_awarded: POINTS,
            status: 'awarded',
          })
          const { data: userDoc } = await supabase
            .from('users')
            .select('points')
            .eq('id', proposal.user_id)
            .single()
          const newPts = (userDoc?.points ?? 0) + POINTS
          await supabase.from('users').update({ points: newPts }).eq('id', proposal.user_id)
          await supabase.from('user_points').insert({
            user_id: proposal.user_id,
            points: POINTS,
            reason: '人物編集提案が承認',
          })
        } catch (e) {
          console.error('points award failed (non-fatal):', e)
        }

        return NextResponse.json({ success: true })
      }

      // 管理者: 人物編集提案を却下
      case 'person_reject': {
        const user = await getAuthUser(request)
        if (!user || !isAdminEmail(user.email)) {
          return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
        }

        const { proposalId, adminNote } = body
        if (!proposalId) {
          return NextResponse.json({ error: 'proposalId required' }, { status: 400 })
        }

        await supabase.from('person_edit_proposals').update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          admin_note: adminNote || null,
        }).eq('id', proposalId)

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
