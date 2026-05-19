// ============================================================
// 三柱推命 (年柱・月柱・日柱) の算出
// ============================================================
// ユーザー向けには「外キャラ / 中キャラ / 裏キャラ」と呼び替えるが、
// ロジック内部は伝統用語で書く。
//
// 干 (Stem) : 甲乙丙丁戊己庚辛壬癸 (10)
// 支 (Branch): 子丑寅卯辰巳午未申酉戌亥 (12)
// 60甲子: 干 i%10, 支 i%12 で表される 60 通り。
//
// 年柱:
//   立春 (2/4 頃) を年の境とする伝統に合わせ、1/1〜2/3 生まれは前年扱い。
//   2/4 を一律境界として近似する (節入時刻まで正確に取らない MVP 実装)。
//
// 月柱:
//   12 節気 (立春, 啓蟄, 清明, 立夏, 芒種, 小暑, 立秋, 白露, 寒露, 立冬, 大雪, 小寒)
//   が月の境。これらの近似日 (年により ±1 日ブレるが MVP では固定値) を使う。
//   月の干は「五虎遁」で年干から決まる。
//
// 日柱:
//   2000-01-01 (土) = 戊午 (= 60甲子 index 54) を基準にして
//   経過日数で剰余計算する。グレゴリオ暦のみ対応 (1900-01-01 以降想定)。

export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸'
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥'

export const STEMS: readonly Stem[] = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'] as const
export const BRANCHES: readonly Branch[] = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'] as const

export interface Pillar {
  stem: Stem
  branch: Branch
}

export interface Sanchu {
  year: Pillar    // 外キャラ
  month: Pillar   // 中キャラ
  day: Pillar     // 裏キャラ
}

// ─────────────────────────────────────────────────────────────
// 節気の近似境界
// ─────────────────────────────────────────────────────────────
// 各「月支」が始まる近似日 (MM, DD)。実際は年により ±1 日ずれるが、
// 占いエンタメ用途では十分。境界 (例: 2/4) 当日は新しい月に含めるとする。
// 寅月から始まる順 (= 2月始まり)。
const MONTH_BOUNDARIES: ReadonlyArray<readonly [number, number, Branch]> = [
  [2, 4, '寅'],   // 立春
  [3, 6, '卯'],   // 啓蟄
  [4, 5, '辰'],   // 清明
  [5, 6, '巳'],   // 立夏
  [6, 6, '午'],   // 芒種
  [7, 7, '未'],   // 小暑
  [8, 8, '申'],   // 立秋
  [9, 8, '酉'],   // 白露
  [10, 8, '戌'],  // 寒露
  [11, 7, '亥'],  // 立冬
  [12, 7, '子'],  // 大雪
  [1, 6, '丑'],   // 小寒 (翌年扱い)
] as const

// 五虎遁: 年干 → 寅月の干。順番に進めて月支ごとに +1 ずつ干を進める。
//   甲・己 年 → 丙寅
//   乙・庚 年 → 戊寅
//   丙・辛 年 → 庚寅
//   丁・壬 年 → 壬寅
//   戊・癸 年 → 甲寅
const YEAR_STEM_TO_TIGER_MONTH_STEM: Record<Stem, Stem> = {
  '甲': '丙', '己': '丙',
  '乙': '戊', '庚': '戊',
  '丙': '庚', '辛': '庚',
  '丁': '壬', '壬': '壬',
  '戊': '甲', '癸': '甲',
}

// ─────────────────────────────────────────────────────────────
// 年柱
// ─────────────────────────────────────────────────────────────
function pillarOfYear(year: number, month: number, day: number): Pillar {
  // 立春 (2/4 近似) より前は前年扱い
  let y = year
  if (month < 2 || (month === 2 && day < 4)) y -= 1
  // 西暦 4 年 = 甲子。
  // (y - 4) を 10 / 12 で剰余。負にならないよう正の剰余に揃える。
  const stemIdx = ((y - 4) % 10 + 10) % 10
  const branchIdx = ((y - 4) % 12 + 12) % 12
  return { stem: STEMS[stemIdx], branch: BRANCHES[branchIdx] }
}

// ─────────────────────────────────────────────────────────────
// 月柱
// ─────────────────────────────────────────────────────────────
function monthBranchOf(month: number, day: number): { branch: Branch; tigerOffset: number } {
  // 寅月 = offset 0, 卯月 = 1, ..., 丑月 = 11
  // 1月で小寒 (1/6) 以降は前年の丑月、それ以前は前年の子月。
  if (month === 1) {
    if (day >= 6) {
      return { branch: '丑', tigerOffset: 11 }
    }
    return { branch: '子', tigerOffset: 10 }
  }
  // 2 月以降: 該当月の境界日を確認
  for (let i = 0; i < MONTH_BOUNDARIES.length - 1; i++) {
    const [bm, bd, br] = MONTH_BOUNDARIES[i]
    if (bm !== month) continue
    if (day >= bd) {
      // この月支に入っている
      return { branch: br, tigerOffset: i }
    }
    // 境界日より前 = 前月の月支のまま
    const prev = MONTH_BOUNDARIES[(i - 1 + MONTH_BOUNDARIES.length) % MONTH_BOUNDARIES.length]
    const prevOffset = (i - 1 + MONTH_BOUNDARIES.length) % MONTH_BOUNDARIES.length
    return { branch: prev[2], tigerOffset: prevOffset }
  }
  // ここに到達するのは想定外だが念のため: 月数から線形に算出
  const offset = ((month - 2) + 12) % 12
  return { branch: BRANCHES[(offset + 2) % 12], tigerOffset: offset }
}

function pillarOfMonth(year: number, month: number, day: number): Pillar {
  const yearStem = pillarOfYear(year, month, day).stem
  const tigerStem = YEAR_STEM_TO_TIGER_MONTH_STEM[yearStem]
  const tigerStemIdx = STEMS.indexOf(tigerStem)
  const { branch, tigerOffset } = monthBranchOf(month, day)
  const stemIdx = (tigerStemIdx + tigerOffset) % 10
  return { stem: STEMS[stemIdx], branch }
}

// ─────────────────────────────────────────────────────────────
// 日柱
// ─────────────────────────────────────────────────────────────
// 2000-01-01 = 60甲子 index 54 (= 戊午) を基準。
// 経過日数 d に対して (54 + d) mod 60 が当日の index。
const REF_DAYS_AT_2000_01_01 = 54

function daysSinceEpoch(year: number, month: number, day: number): number {
  // Date オブジェクトでは UTC を使い、タイムゾーン差で日付が変わらないようにする。
  const t = Date.UTC(year, month - 1, day)
  const ref = Date.UTC(2000, 0, 1)
  return Math.round((t - ref) / 86_400_000)
}

function pillarOfDay(year: number, month: number, day: number): Pillar {
  const d = daysSinceEpoch(year, month, day)
  const idx = ((REF_DAYS_AT_2000_01_01 + d) % 60 + 60) % 60
  return { stem: STEMS[idx % 10], branch: BRANCHES[idx % 12] }
}

// ─────────────────────────────────────────────────────────────
// 公開 API
// ─────────────────────────────────────────────────────────────
export function calcSanchu(year: number, month: number, day: number): Sanchu {
  return {
    year:  pillarOfYear(year, month, day),
    month: pillarOfMonth(year, month, day),
    day:   pillarOfDay(year, month, day),
  }
}

// 干支文字列 (例: '甲子') を返す
export function pillarToString(p: Pillar): string {
  return `${p.stem}${p.branch}`
}
