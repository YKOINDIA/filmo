// ============================================================
// Filmo Agey — 年齢計算ユーティリティ
// ============================================================
// 生年月日が分かる人は「正確な年齢」を、だいたいの年齢しか分からない人は
// 「約◯歳」を表示する。年齢が全く分からない人 (名前だけメモ) にも対応する。
// すべて純粋関数。`now` を引数で受け取れるようにしてテスト可能にしている。

export interface AgeParts {
  years: number
  months: number
  days: number
  /** 生年月日が未来 (誤入力 or 出産予定日) の場合 true */
  isFuture: boolean
}

/** 年齢解決の入力。null は「不明」を表す。 */
export interface AgeSource {
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
  approx_age: number | null
  /** 概算年齢の基準日 'YYYY-MM-DD'。null なら今日を基準にする。 */
  approx_age_as_of: string | null
}

export interface ResolvedAge {
  /** exact = 生年月日あり / approx = 概算 / none = 年齢不明 */
  kind: 'exact' | 'approx' | 'none'
  /** 表示用ラベル ('3歳2か月' | '約5歳' | '年齢未登録') */
  label: string
  /** ソート・比較用の推定満年齢 (歳, 小数あり)。none のとき null。 */
  years: number | null
  isFuture: boolean
}

/**
 * カレンダーベースで年齢を年・月・日に分解する (生年月日が分かる人向け)。
 */
export function calcAge(
  birthYear: number,
  birthMonth: number,
  birthDay: number,
  now: Date = new Date(),
): AgeParts {
  const birth = new Date(birthYear, birthMonth - 1, birthDay)

  if (birth.getTime() > now.getTime()) {
    return { years: 0, months: 0, days: 0, isFuture: true }
  }

  let years = now.getFullYear() - birthYear
  let months = now.getMonth() - (birthMonth - 1)
  let days = now.getDate() - birthDay

  if (days < 0) {
    months -= 1
    const daysInPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    days += daysInPrevMonth
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  return { years, months, days, isFuture: false }
}

/**
 * 年齢を日本語ラベルにする (生年月日あり)。
 *   - 1歳以上:  「3歳2か月」(月が 0 のときは「3歳」)
 *   - 1歳未満:  「10か月」(月が 0 のときは「5日」)
 *   - 生まれた当日: 「0日」
 *   - 未来:      「誕生前」
 */
export function formatAge(parts: AgeParts): string {
  if (parts.isFuture) return '誕生前'
  if (parts.years >= 1) {
    return parts.months > 0 ? `${parts.years}歳${parts.months}か月` : `${parts.years}歳`
  }
  if (parts.months >= 1) {
    return `${parts.months}か月`
  }
  return `${parts.days}日`
}

/** 2 つの日付の「満」経過年数 (誕生日ベース)。負なら 0。 */
function fullYearsBetween(from: Date, to: Date): number {
  if (to.getTime() < from.getTime()) return 0
  let years = to.getFullYear() - from.getFullYear()
  const monthDiff = to.getMonth() - from.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && to.getDate() < from.getDate())) {
    years -= 1
  }
  return Math.max(0, years)
}

function parseISODate(s: string): Date | null {
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/**
 * 生年月日 / 概算年齢 / 不明 を吸収して表示用の年齢を返す。
 * 一覧カードはこの 1 関数だけ呼べばよい。
 */
export function resolveAge(src: AgeSource, now: Date = new Date()): ResolvedAge {
  // 1) 正確な生年月日が揃っている
  if (src.birth_year && src.birth_month && src.birth_day) {
    const parts = calcAge(src.birth_year, src.birth_month, src.birth_day, now)
    const years = parts.isFuture ? 0 : parts.years + parts.months / 12
    return { kind: 'exact', label: formatAge(parts), years, isFuture: parts.isFuture }
  }

  // 2) 概算年齢のみ → 基準日からの経過年数を加算
  if (src.approx_age != null) {
    const asOf = src.approx_age_as_of ? parseISODate(src.approx_age_as_of) : null
    const elapsed = asOf ? fullYearsBetween(asOf, now) : 0
    const current = src.approx_age + elapsed
    return { kind: 'approx', label: `約${current}歳`, years: current, isFuture: false }
  }

  // 3) 年齢不明
  return { kind: 'none', label: '年齢未登録', years: null, isFuture: false }
}

/**
 * 次の誕生日までの日数。今日が誕生日なら 0。(生年月日が分かる人向け)
 */
export function daysUntilNextBirthday(
  birthMonth: number,
  birthDay: number,
  now: Date = new Date(),
): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let next = new Date(now.getFullYear(), birthMonth - 1, birthDay)
  if (next.getTime() < today.getTime()) {
    next = new Date(now.getFullYear() + 1, birthMonth - 1, birthDay)
  }
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((next.getTime() - today.getTime()) / MS_PER_DAY)
}
