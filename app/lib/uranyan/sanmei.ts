// ============================================================
// 算命学: 十大主星 (陽占 主星) 算出
// ============================================================
// 算命学では 日干 を基準にして、他の 干 (または 支蔵干) との
// 「五行 + 陰陽」関係から 通変星 → 十大主星 を導く。
//
// MVP の天命トリセツでは 陽占 5 ポジションのうち 3 つを使う:
//   北方主星 = 日干 vs 年干    → 外キャラ (社会的な顔・初年運)
//   中央主星 = 日干 vs 月支蔵干 → 中キャラ (本人の心・中年運)
//   東方主星 = 日干 vs 日支蔵干 → 裏キャラ (配偶者/近しい人にしか見せない本性)
//
// 支蔵干は MVP では「本気 (= 最も支配的な蔵干)」のみを用いる。
// 余気/中気は精度向上時に追加。

import type { Stem, Branch, Sanchu } from './sanchu'
import { STEMS } from './sanchu'

// ─────────────────────────────────────────────────────────────
// 五行・陰陽
// ─────────────────────────────────────────────────────────────
type Element = '木' | '火' | '土' | '金' | '水'
type YinYang = '陽' | '陰'

const STEM_ELEMENT: Record<Stem, Element> = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
}

const STEM_YINYANG: Record<Stem, YinYang> = {
  '甲': '陽', '乙': '陰',
  '丙': '陽', '丁': '陰',
  '戊': '陽', '己': '陰',
  '庚': '陽', '辛': '陰',
  '壬': '陽', '癸': '陰',
}

// 支蔵干 (本気のみ)
// 子=癸, 丑=己, 寅=甲, 卯=乙, 辰=戊, 巳=丙,
// 午=丁, 未=己, 申=庚, 酉=辛, 戌=戊, 亥=壬
const BRANCH_MAIN_STEM: Record<Branch, Stem> = {
  '子': '癸', '丑': '己', '寅': '甲', '卯': '乙',
  '辰': '戊', '巳': '丙', '午': '丁', '未': '己',
  '申': '庚', '酉': '辛', '戌': '戊', '亥': '壬',
}

// ─────────────────────────────────────────────────────────────
// 十大主星
// ─────────────────────────────────────────────────────────────
export type MainStar =
  | '貫索星' | '石門星'
  | '鳳閣星' | '調舒星'
  | '禄存星' | '司禄星'
  | '車騎星' | '牽牛星'
  | '龍高星' | '玉堂星'

type GogyoRelation = '比和' | '我生' | '我剋' | '剋我' | '生我'

// 五行関係を判定
// self が target に対してどんな関係か。
function gogyoRelation(self: Element, target: Element): GogyoRelation {
  if (self === target) return '比和'
  // 相生: 木→火→土→金→水→木
  const SHENG: Record<Element, Element> = { '木':'火','火':'土','土':'金','金':'水','水':'木' }
  if (SHENG[self] === target) return '我生'   // 自分が target を生む
  if (SHENG[target] === self) return '生我'   // target が自分を生む
  // 相剋: 木→土, 火→金, 土→水, 金→木, 水→火
  const KE: Record<Element, Element> = { '木':'土','火':'金','土':'水','金':'木','水':'火' }
  if (KE[self] === target) return '我剋'      // 自分が target を剋す
  // 残りは 剋我
  return '剋我'
}

// (五行関係, 同陰陽?) → 通変星 → 十大主星
const STAR_TABLE: Record<GogyoRelation, { same: MainStar; diff: MainStar }> = {
  '比和': { same: '貫索星', diff: '石門星' }, // 比肩 / 劫財
  '我生': { same: '鳳閣星', diff: '調舒星' }, // 食神 / 傷官
  '我剋': { same: '禄存星', diff: '司禄星' }, // 偏財 / 正財
  '剋我': { same: '車騎星', diff: '牽牛星' }, // 偏官 / 正官
  '生我': { same: '龍高星', diff: '玉堂星' }, // 偏印 / 印綬
}

// 日干 vs 対象干 から十大主星を導出
export function deriveMainStar(dayStem: Stem, target: Stem): MainStar {
  const rel = gogyoRelation(STEM_ELEMENT[dayStem], STEM_ELEMENT[target])
  const sameYY = STEM_YINYANG[dayStem] === STEM_YINYANG[target]
  return sameYY ? STAR_TABLE[rel].same : STAR_TABLE[rel].diff
}

// ─────────────────────────────────────────────────────────────
// 陽占 三主星 (天命トリセツ用)
// ─────────────────────────────────────────────────────────────
export interface ThreeStars {
  north: MainStar    // 北方主星 = 日干 vs 年干 (外キャラ)
  center: MainStar   // 中央主星 = 日干 vs 月支蔵干 (中キャラ)
  east: MainStar     // 東方主星 = 日干 vs 日支蔵干 (裏キャラ)
}

export function deriveThreeStars(s: Sanchu): ThreeStars {
  const day = s.day.stem
  return {
    north:  deriveMainStar(day, s.year.stem),
    center: deriveMainStar(day, BRANCH_MAIN_STEM[s.month.branch]),
    east:   deriveMainStar(day, BRANCH_MAIN_STEM[s.day.branch]),
  }
}

// ─────────────────────────────────────────────────────────────
// 公開: 内部関数の再エクスポート (テスト用)
// ─────────────────────────────────────────────────────────────
export const __test = { STEM_ELEMENT, STEM_YINYANG, BRANCH_MAIN_STEM, gogyoRelation }

// 不使用警告対策 (STEMS は import するだけで参照は無いケースがあるため、内部で参照しておく)
void STEMS
