import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/app/lib/supabase-admin'

/**
 * 人物 (監督・俳優・脚本家) 登録 API。
 *
 * TMDB に無い人物を Filmo 側に登録できる。movies の /api/works register と同様の
 * 「負ID + data_source='user'」パターン。
 *
 * 認証必須 (Bearer token)。サービスロールで insert するが、created_by を
 * トークン検証済みの uid に固定して RLS を回避しつつ安全性を担保する。
 */

interface RegisterBody {
  action?: 'register'
  name?: string
  originalName?: string
  knownForDepartment?: string  // 'Directing' | 'Writing' | 'Acting'
  biography?: string
  birthday?: string  // YYYY-MM-DD
  placeOfBirth?: string
  profileUrl?: string  // フル URL or TMDB style relative path
  homepage?: string
}

const VALID_DEPARTMENTS = new Set(['Directing', 'Writing', 'Acting', 'Production', 'Camera', 'Editing', 'Sound', 'Art'])
const NAME_MAX = 100
const BIO_MAX = 3000
const PLACE_MAX = 200

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

function sanitizeUrl(input: string | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  // 受け入れる形式: フル http(s) URL のみ。javascript: 等は弾く。
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  }

  let payload: RegisterBody
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.action !== 'register') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const name = (payload.name || '').trim()
  if (!name) {
    return NextResponse.json({ error: '名前は必須です' }, { status: 400 })
  }
  if (name.length > NAME_MAX) {
    return NextResponse.json({ error: `名前は ${NAME_MAX} 文字以内にしてください` }, { status: 400 })
  }

  const originalName = (payload.originalName || '').trim().slice(0, NAME_MAX) || null
  const biography = (payload.biography || '').trim().slice(0, BIO_MAX) || null
  const placeOfBirth = (payload.placeOfBirth || '').trim().slice(0, PLACE_MAX) || null
  const homepage = sanitizeUrl(payload.homepage)
  const profileUrl = sanitizeUrl(payload.profileUrl)
  const knownFor = payload.knownForDepartment && VALID_DEPARTMENTS.has(payload.knownForDepartment)
    ? payload.knownForDepartment
    : null

  // 生年月日は YYYY-MM-DD 形式のみ受理。それ以外は null。
  const birthday = (() => {
    const v = (payload.birthday || '').trim()
    if (!v) return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return null
    return v
  })()

  const admin = getSupabaseAdmin()

  // 重複チェック (TMDB 含む。case-insensitive name 完全一致)。
  // 案件が増えたら ILIKE 部分一致など拡張する。
  const { data: dupes } = await admin
    .from('persons')
    .select('id, name, profile_path, known_for, data_source, birthday')
    .ilike('name', name)
    .limit(5)

  if (dupes && dupes.length > 0) {
    return NextResponse.json({
      duplicates: dupes,
      message: '同じ名前の人物が既に登録されています。該当人物がないか確認してください。',
    }, { status: 409 })
  }

  // 既存の最小 ID から -1 して負IDを割り当てる (movies 登録と同方式)
  const { data: minRow } = await admin
    .from('persons')
    .select('id')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()
  const newId = Math.min((minRow?.id || 0) - 1, -1)

  const { data: inserted, error } = await admin
    .from('persons')
    .insert({
      id: newId,
      tmdb_id: null,
      name,
      original_name: originalName,
      profile_path: profileUrl,
      biography,
      birthday,
      place_of_birth: placeOfBirth,
      homepage,
      known_for: knownFor ? [knownFor] : [],
      data_source: 'user',
      is_verified: false,
      created_by: user.id,
      cached_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('person insert failed:', error)
    if ((error.code || '') === '23505') {
      return NextResponse.json({ error: '同じ名前で既に登録しています' }, { status: 409 })
    }
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }

  // 貢献ログ。awardContributionPoints は client-side helper だが
  // ここでは server から直接 insert する (auth.uid なし RLS バイパスのため)。
  // ポイントの加算は client 側で行うか、Trigger で行うのが理想だが、
  // 既存 /api/works register もポイント加算を呼び出していないので合わせる。
  await admin.from('data_contributions').insert({
    user_id: user.id,
    contribution_type: 'register_person',
    person_id: newId,
    points_awarded: 15,
    status: 'awarded',
  }).then(() => undefined, () => undefined)

  return NextResponse.json({ person: inserted })
}
