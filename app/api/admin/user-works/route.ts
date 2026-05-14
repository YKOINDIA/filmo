import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
import { isAdminEmail } from '../../../lib/adminAuth'

/**
 * 管理画面: ユーザー登録作品 (movies.data_source = 'user') の一覧 / 編集 API。
 *
 * - GET    ?email=admin@... &status=all|unverified|verified&q=keyword&page=0
 *          → 一覧 (50件/page) を新しい順で返す
 * - POST   action=update      : 任意のフィールドを更新
 * - POST   action=verify      : is_verified を切り替え
 * - POST   action=delete      : 行を物理削除 (FK 依存先は削除カスケード)
 *
 * 編集は重い責務 (FK 整合・ポイント返却など) を伴うことがあるので、
 * 将来的に行を残しつつ merged_into で別作品へ統合する操作も同 API に追加する想定。
 */

async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const email = req.nextUrl.searchParams.get('email')
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

async function authorizeBody(req: NextRequest, email?: string): Promise<NextResponse | null> {
  const e = email ?? req.nextUrl.searchParams.get('email')
  if (!isAdminEmail(e)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

const PAGE_SIZE = 50

// 編集を許可するカラムのホワイトリスト。movies の他のカラム (vote_average 等) は
// 編集禁止 (集計値が壊れるため)。
const EDITABLE_FIELDS = new Set([
  'title',
  'original_title',
  'overview',
  'release_date',
  'release_year_only',
  'media_type',
  'homepage',
  'poster_path',
  'backdrop_path',
  'runtime',
  'genres',
  'production_countries',
  'credits',
  'is_verified',
  'merged_into',
])

export async function GET(req: NextRequest) {
  const authErr = await authorize(req)
  if (authErr) return authErr

  const admin = getSupabaseAdmin()
  const status = req.nextUrl.searchParams.get('status') || 'all'
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get('page') || '0', 10) || 0)

  let query = admin
    .from('movies')
    .select('id, tmdb_id, title, original_title, overview, media_type, release_date, release_year_only, homepage, poster_path, backdrop_path, runtime, genres, credits, created_by, is_verified, merged_into, cached_at', { count: 'exact' })
    .eq('data_source', 'user')
    .order('cached_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (status === 'unverified') query = query.eq('is_verified', false)
  else if (status === 'verified') query = query.eq('is_verified', true)
  else if (status === 'merged') query = query.not('merged_into', 'is', null)
  else if (status === 'active') query = query.is('merged_into', null)

  if (q) {
    // 別々の .ilike() を 2 回投げる方が確実だが、ここは管理画面で結果件数が
    // 少ないので .or() のままでも十分。値はサニタイズしておく。
    const safe = q.replace(/[(),"\\]/g, ' ').trim()
    if (safe) query = query.or(`title.ilike.%${safe}%,original_title.ilike.%${safe}%`)
  }

  const { data, error, count } = await query
  if (error) {
    console.error('admin user-works list failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    works: data || [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body.action as string | undefined
  const adminEmail = body.email as string | undefined

  const authErr = await authorizeBody(req, adminEmail)
  if (authErr) return authErr

  const admin = getSupabaseAdmin()

  try {
    switch (action) {
      // 個別フィールドを更新 (ホワイトリスト経由)
      case 'update': {
        const movieId = body.movieId as number | undefined
        const patch = (body.patch || {}) as Record<string, unknown>
        if (!movieId || movieId >= 0) {
          return NextResponse.json({ error: 'movieId (negative) required' }, { status: 400 })
        }

        const update: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(patch)) {
          if (!EDITABLE_FIELDS.has(key)) continue
          // 空文字は null 扱い (release_date 等で空欄にする用)
          if (typeof value === 'string' && value.trim() === '') {
            update[key] = null
          } else {
            update[key] = value
          }
        }

        // release_year_only と release_date の整合性を保つ
        if (update.release_year_only === true && typeof update.release_date === 'string') {
          // 年だけ送られてきた場合 YYYY-01-01 に揃える
          const m = (update.release_date as string).match(/^(\d{4})/)
          if (m) update.release_date = `${m[1]}-01-01`
        }

        if (Object.keys(update).length === 0) {
          return NextResponse.json({ error: '更新可能なフィールドがありません' }, { status: 400 })
        }

        const { data, error } = await admin
          .from('movies')
          .update(update)
          .eq('id', movieId)
          .eq('data_source', 'user')   // 念のため: TMDB データを誤って更新しないよう絞る
          .select()
          .single()

        if (error) {
          console.error('admin user-works update failed:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ work: data })
      }

      // 検証フラグだけ切り替えるショートカット
      case 'verify': {
        const movieId = body.movieId as number | undefined
        const verified = body.verified as boolean | undefined
        if (!movieId || movieId >= 0 || typeof verified !== 'boolean') {
          return NextResponse.json({ error: 'movieId and verified required' }, { status: 400 })
        }

        const { error } = await admin
          .from('movies')
          .update({ is_verified: verified })
          .eq('id', movieId)
          .eq('data_source', 'user')

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      // 物理削除 (FK で reviews / watchlists 等もカスケード削除されることに注意)
      case 'delete': {
        const movieId = body.movieId as number | undefined
        if (!movieId || movieId >= 0) {
          return NextResponse.json({ error: 'movieId (negative) required' }, { status: 400 })
        }

        const { error } = await admin
          .from('movies')
          .delete()
          .eq('id', movieId)
          .eq('data_source', 'user')

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
