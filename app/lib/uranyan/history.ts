// ============================================================
// うらにゃん。: 占い履歴 (uranyan_readings) のロード/保存/レビュー
// ============================================================
// 履歴の保存単位:
//   menu='life'         → 1人 (天命トリセツ)
//   menu='compat'       → 2人 (相性)
//   menu='group_compat' → 3〜8人 (グループ相性)
//
// result_summary は管理画面で「同じパターンの低評価集計」に使われるので
// テンプレを変えても安定するキーにする。例: 天命=主星3つ, 相性=関係名。

import { supabase } from '../supabase'
import type { LifeReading } from './templates'
import type { CompatibilityReading } from './compatTemplates'
import type { GroupCompatReading } from './groupCompat'
import type { PeriodReading } from './period'

export type ReadingMenu = 'life' | 'compat' | 'group_compat' | 'period'

export interface ReadingRow {
  id: string
  user_id: string
  menu: ReadingMenu
  target_names: string[]
  target_birthdates: string[]   // YYYY-MM-DD
  period_label: string | null
  period_start: string | null
  period_end: string | null
  result_summary: string
  result_payload: unknown
  rating: number | null
  review_text: string | null
  reviewed_at: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// 保存ペイロード作成 (menu 別)
// ─────────────────────────────────────────────────────────────
function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

export function buildLifeSavePayload(
  target: { name: string; year: number; month: number; day: number },
  reading: LifeReading,
): { target_names: string[]; target_birthdates: string[]; result_summary: string; result_payload: unknown } {
  return {
    target_names: [target.name],
    target_birthdates: [isoDate(target.year, target.month, target.day)],
    result_summary: `${reading.outer.star}×${reading.middle.star}×${reading.inner.star}`,
    result_payload: reading,
  }
}

export function buildCompatSavePayload(
  a: { name: string; year: number; month: number; day: number },
  b: { name: string; year: number; month: number; day: number },
  reading: CompatibilityReading,
): { target_names: string[]; target_birthdates: string[]; result_summary: string; result_payload: unknown } {
  return {
    target_names: [a.name, b.name],
    target_birthdates: [isoDate(a.year, a.month, a.day), isoDate(b.year, b.month, b.day)],
    result_summary: reading.relation,
    result_payload: reading,
  }
}

export function buildPeriodSavePayload(
  user: { name: string; year: number; month: number; day: number },
  periodLabel: string,
  reading: PeriodReading,
): { target_names: string[]; target_birthdates: string[]; result_summary: string; result_payload: unknown } {
  return {
    target_names: [user.name],
    target_birthdates: [isoDate(user.year, user.month, user.day)],
    result_summary: `${reading.themeHeadline}:★${reading.avgRank}/5`,
    result_payload: { ...reading, periodLabel },
  }
}

export function buildGroupCompatSavePayload(
  members: Array<{ name: string; year: number; month: number; day: number }>,
  reading: GroupCompatReading,
): { target_names: string[]; target_birthdates: string[]; result_summary: string; result_payload: unknown } {
  return {
    target_names: members.map(m => m.name),
    target_birthdates: members.map(m => isoDate(m.year, m.month, m.day)),
    result_summary: `調和度:${reading.harmonyScore.toFixed(1)}/5`,
    result_payload: reading,
  }
}

// ─────────────────────────────────────────────────────────────
// 保存 / 一覧 / レビュー
// ─────────────────────────────────────────────────────────────
export interface SaveInput {
  menu: ReadingMenu
  target_names: string[]
  target_birthdates: string[]
  result_summary: string
  result_payload: unknown
  period_label?: string | null
  period_start?: string | null     // YYYY-MM-DD
  period_end?: string | null       // YYYY-MM-DD
}

export async function saveReading(input: SaveInput): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const { data, error } = await supabase
    .from('uranyan_readings')
    .insert({
      user_id: session.user.id,
      menu: input.menu,
      target_names: input.target_names,
      target_birthdates: input.target_birthdates,
      result_summary: input.result_summary,
      result_payload: input.result_payload,
      period_label: input.period_label ?? null,
      period_start: input.period_start ?? null,
      period_end: input.period_end ?? null,
    })
    .select('id')
    .single()
  if (error) {
    console.warn('[uranyan] saveReading failed:', error)
    return null
  }
  return data!.id
}

export async function loadReadings(limit = 50): Promise<ReadingRow[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return []
  const { data, error } = await supabase
    .from('uranyan_readings')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[uranyan] loadReadings failed:', error)
    return []
  }
  return (data ?? []) as ReadingRow[]
}

export async function reviewReading(id: string, rating: number, reviewText: string | null): Promise<boolean> {
  if (rating < 1 || rating > 5) return false
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return false
  const { error } = await supabase
    .from('uranyan_readings')
    .update({
      rating,
      review_text: reviewText && reviewText.trim() ? reviewText.trim() : null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', session.user.id)
  if (error) {
    console.warn('[uranyan] reviewReading failed:', error)
    return false
  }
  return true
}

export async function deleteReading(id: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return false
  const { error } = await supabase
    .from('uranyan_readings')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id)
  return !error
}

// ─────────────────────────────────────────────────────────────
// レビュー可否判定
// ─────────────────────────────────────────────────────────────
/**
 * レビュー対象として表示するかどうか:
 *   - period_end が指定されている → period_end を過ぎていればレビュー可
 *   - period_end が未指定          → 占ってから 1 日以上経っていればレビュー可
 *                                     (即レビューはノイズになるので少し置く)
 */
export function isReviewable(r: ReadingRow, nowISO?: string): boolean {
  const now = nowISO ? new Date(nowISO) : new Date()
  if (r.period_end) {
    return new Date(r.period_end) <= now
  }
  const created = new Date(r.created_at)
  return (now.getTime() - created.getTime()) >= 24 * 3600 * 1000
}
