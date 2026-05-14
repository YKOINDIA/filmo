import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'

function sanitizeHomepage(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

// YYYY-MM-DD 形式の日付を検証して返す。範囲外の月日や不正な日付は null。
function sanitizeReleaseDate(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const v = input.trim()
  if (!v) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  // 入力と再フォーマット結果が一致しない（例: 2024-02-30）場合は弾く
  if (d.toISOString().slice(0, 10) !== v) return null
  return v
}

interface CreditInput {
  personId?: number          // 既存 persons（TMDB or ユーザー登録）のID
  name: string
  profilePath?: string | null
  role: 'director' | 'writer' | 'cast'
  character?: string         // role='cast' のとき
}

interface CreditsBlob {
  cast: Array<{
    id: number | null
    name: string
    profile_path: string | null
    character?: string
    order?: number
  }>
  crew: Array<{
    id: number | null
    name: string
    profile_path: string | null
    job: string
    department: string
  }>
}

// クライアントから受け取った credits 配列を movies.credits の JSONB 形式に整形する
function buildCreditsBlob(raw: unknown): CreditsBlob {
  const out: CreditsBlob = { cast: [], crew: [] }
  if (!Array.isArray(raw)) return out
  let castOrder = 0
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const c = r as Partial<CreditInput>
    const name = typeof c.name === 'string' ? c.name.trim().slice(0, 100) : ''
    if (!name) continue
    const id = typeof c.personId === 'number' && Number.isFinite(c.personId) ? c.personId : null
    const profile_path = typeof c.profilePath === 'string' && c.profilePath ? c.profilePath : null
    if (c.role === 'cast') {
      out.cast.push({
        id,
        name,
        profile_path,
        character: typeof c.character === 'string' ? c.character.trim().slice(0, 200) : undefined,
        order: castOrder++,
      })
    } else if (c.role === 'writer') {
      out.crew.push({ id, name, profile_path, job: 'Screenplay', department: 'Writing' })
    } else {
      // default: director
      out.crew.push({ id, name, profile_path, job: 'Director', department: 'Directing' })
    }
  }
  return out
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const action = searchParams.get('action')
  const supabase = getSupabaseAdmin()

  try {
    switch (action) {
      // ローカルDB内のユーザー登録作品を検索
      // .or() フィルタ文字列のパース挙動が PostgREST のバージョンや特殊文字で
      // ばらつくため、title と original_title それぞれを別クエリで .ilike() して
      // 結果をマージする方式に統一する (確実かつ Supabase JS のドキュメント済 API)。
      case 'search_local': {
        const raw = searchParams.get('query') || ''
        const q = raw.trim()
        if (!q) return NextResponse.json({ results: [] })

        const cols = 'id, title, original_title, media_type, release_date, poster_path, vote_average, data_source, is_verified'
        const pattern = `%${q}%`

        const [byTitle, byOriginal] = await Promise.all([
          supabase
            .from('movies')
            .select(cols)
            .ilike('title', pattern)
            .eq('data_source', 'user')
            .is('merged_into', null)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('movies')
            .select(cols)
            .ilike('original_title', pattern)
            .eq('data_source', 'user')
            .is('merged_into', null)
            .order('created_at', { ascending: false })
            .limit(20),
        ])

        if (byTitle.error) console.error('search_local title query failed:', byTitle.error)
        if (byOriginal.error) console.error('search_local original_title query failed:', byOriginal.error)

        type Row = NonNullable<typeof byTitle.data>[number]
        const seen = new Set<number>()
        const merged: Row[] = []
        for (const row of [...(byTitle.data || []), ...(byOriginal.data || [])]) {
          if (seen.has(row.id)) continue
          seen.add(row.id)
          merged.push(row)
        }

        // 観測用ログ (本番でも残す: 0件報告が来た時にここで原因を切り分ける)
        console.log(`search_local q="${q}" hits=${merged.length} (title=${byTitle.data?.length || 0}, original=${byOriginal.data?.length || 0})`)

        return NextResponse.json({ results: merged.slice(0, 20) })
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
        const { userId, title, originalTitle, mediaType, year, releaseDate: releaseDateInput, description, homepage, credits } = body
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

        // release_date は「年月日」優先、無ければ「年」から YYYY-01-01 を組み立て、
        // 後者の場合は year_only フラグを立てて表示時に年だけ見せる。
        const sanitizedDate = sanitizeReleaseDate(releaseDateInput)
        const releaseDate = sanitizedDate ?? (year ? `${year}-01-01` : null)
        const releaseYearOnly = !sanitizedDate && !!year && releaseDate !== null

        const homepageClean = sanitizeHomepage(homepage)
        const creditsBlob = buildCreditsBlob(credits)

        const { data: inserted, error } = await supabase.from('movies').insert({
          id: newId,
          tmdb_id: null,
          title: title.trim(),
          original_title: originalTitle?.trim() || null,
          overview: description?.trim() || null,
          media_type: mediaType || 'tv',
          release_date: releaseDate,
          release_year_only: releaseYearOnly,
          homepage: homepageClean,
          data_source: 'user',
          created_by: userId,
          is_verified: false,
          poster_path: null,
          backdrop_path: null,
          vote_average: 0,
          vote_count: 0,
          genres: [],
          production_countries: [],
          credits: creditsBlob,
          cached_at: new Date().toISOString(),
        }).select().single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // 管理画面で検証できるよう、work_requests に auto_approved として記録する。
        // 失敗しても作品登録自体は成功扱いとする（管理側の可視化は best-effort）。
        try {
          await supabase.from('work_requests').insert({
            user_id: userId,
            title: title.trim(),
            original_title: originalTitle?.trim() || null,
            media_type: mediaType || 'tv',
            year: year || null,
            release_date: sanitizedDate,
            description: description?.trim() || null,
            homepage: homepageClean,
            credits: creditsBlob,
            status: 'auto_approved',
            movie_id: inserted.id,
          })
        } catch (e) {
          console.error('work_requests mirror insert failed (non-fatal):', e)
        }

        return NextResponse.json({ work: inserted })
      }

      // リクエスト: 管理者に追加を依頼
      case 'request': {
        const { userId, title, originalTitle, mediaType, year, releaseDate: releaseDateInput, description, homepage, credits } = body
        if (!userId || !title) {
          return NextResponse.json({ error: 'userId and title required' }, { status: 400 })
        }

        const homepageClean = sanitizeHomepage(homepage)
        const creditsBlob = buildCreditsBlob(credits)
        const sanitizedDate = sanitizeReleaseDate(releaseDateInput)

        const { data: req, error } = await supabase.from('work_requests').insert({
          user_id: userId,
          title: title.trim(),
          original_title: originalTitle?.trim() || null,
          media_type: mediaType || 'tv',
          year: year || null,
          release_date: sanitizedDate,
          description: description?.trim() || null,
          homepage: homepageClean,
          credits: creditsBlob,
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
