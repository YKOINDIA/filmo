// ============================================================
// うらにゃん。: 今日の運勢
// ============================================================
// アルゴリズム:
//   1. 算命学: ユーザーの日干 vs 今日の日干 の五行関係+陰陽から 1〜5 のスコア
//   2. 宿曜: ユーザーの宿 vs 今日の宿 の距離から関係名 (吉凶) を取得
//   3. 総合: 上記 2 つを平均 → 5 段階の「運勢ランク」
//   4. 表示要素:
//      - 運勢ランク (★1〜5) と一言ラベル ("勝負日!" 等)
//      - ラッキーカラー (今日の日干から)
//      - ガチ病み回避カラー (今日の日干の "剋我" 関係の干から → 安定色)
//      - ラッキー行動 / NG 行動
//      - ニャンじろう & ポチ の掛け合い
//
// 結果は (birthdate, today) で決定論的に算出。履歴 DB には保存しない。

import { calcSanchu, STEMS, BRANCHES, type Stem, type Branch } from './sanchu'
import { mansionOf, mansionIndex, type Mansion } from './sukuyo'
import { RELATION_TEMPLATES, type Relation } from './compatTemplates'

// ─────────────────────────────────────────────────────────────
// 五行・陰陽 (sanmei.ts と重複だが、循環 import を避けて再定義)
// ─────────────────────────────────────────────────────────────
type Element = '木' | '火' | '土' | '金' | '水'
const STEM_ELEMENT: Record<Stem, Element> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
}
const STEM_YINYANG: Record<Stem, '陽' | '陰'> = {
  '甲': '陽', '乙': '陰', '丙': '陽', '丁': '陰',
  '戊': '陽', '己': '陰', '庚': '陽', '辛': '陰',
  '壬': '陽', '癸': '陰',
}
const SHENG: Record<Element, Element> = { '木':'火','火':'土','土':'金','金':'水','水':'木' }
const KE:    Record<Element, Element> = { '木':'土','火':'金','土':'水','金':'木','水':'火' }

type GogyoRel = '比和' | '我生' | '我剋' | '剋我' | '生我'
function gogyo(self: Element, other: Element): GogyoRel {
  if (self === other) return '比和'
  if (SHENG[self] === other) return '我生'
  if (SHENG[other] === self) return '生我'
  if (KE[self] === other) return '我剋'
  return '剋我'
}

// ─────────────────────────────────────────────────────────────
// 算命学の今日スコア (1〜5)
// ─────────────────────────────────────────────────────────────
const SANMEI_BASE_SCORE: Record<GogyoRel, number> = {
  '比和': 3,   // 中庸
  '我生': 5,   // 発信・表現が運に乗る (最高)
  '我剋': 4,   // 押せる日
  '剋我': 2,   // 踏ん張る日 (注意)
  '生我': 4,   // 受け取る・学べる日
}

const SANMEI_LABEL: Record<GogyoRel, string> = {
  '比和': 'いつも通りの安定日',
  '我生': '発信が運に乗る日',
  '我剋': '勝負に出ていい日',
  '剋我': 'いったん踏ん張る日',
  '生我': '誰かに頼っていい日',
}

const LUCKY_ACTION: Record<GogyoRel, string> = {
  '比和': '親しい人と過ごす。テンションは抑えめに、味のある日に。',
  '我生': '気になる人にDM・告白・自己プロデュース。あんたの言葉が刺さる日。',
  '我剋': 'テスト・面接・勝負ごとに挑む。今日のあんたは押せる。',
  '剋我': '新しいことは控えて、いつも通りの動きで。失敗を引きずらない。',
  '生我': '先輩・親・大人に頼ってOK。受け取る側にまわると吉。',
}

const NG_ACTION: Record<GogyoRel, string> = {
  '比和': 'いきなりキャラ変・派手な決断。今日は地味な方が勝つ。',
  '我生': '受け身でいると損する。「待ち」より「攻め」。',
  '我剋': '細かい計画を練り直すこと。考えるより動いた方が早い。',
  '剋我': 'ピリピリしてる相手と衝突。スルー力大事。',
  '生我': 'ぜんぶ自分で抱える。今日は助けを借りる方が結果が出る。',
}

// ─────────────────────────────────────────────────────────────
// ラッキーカラー (10干別) — templates.ts と同じテーブルだが
// 循環 import を避けて再定義
// ─────────────────────────────────────────────────────────────
const COLOR_BY_STEM: Record<Stem, { name: string; hex: string }> = {
  '甲': { name: '若葉グリーン',     hex: '#7ED957' },
  '乙': { name: 'ミントグリーン',   hex: '#B8E6C1' },
  '丙': { name: 'ビビッドオレンジ', hex: '#FF7A45' },
  '丁': { name: 'ペールピンク',     hex: '#FFC8DD' },
  '戊': { name: 'テラコッタブラウン', hex: '#B5651D' },
  '己': { name: 'バニラベージュ',   hex: '#F5E6CA' },
  '庚': { name: 'シルバーグレー',   hex: '#C0C0C8' },
  '辛': { name: 'パールホワイト',   hex: '#F8F4EC' },
  '壬': { name: 'ディープネイビー', hex: '#1F2A55' },
  '癸': { name: 'くすみラベンダー', hex: '#B7A8D9' },
}

// ガチ病み回避カラー = 今日の日干を生む五行 (= 母なる支え) の代表色
//   木 ← 水 (壬癸)、火 ← 木、土 ← 火、金 ← 土、水 ← 金
function escapeColorOf(todayStem: Stem): { name: string; hex: string } {
  const todayElem = STEM_ELEMENT[todayStem]
  const motherElem: Element = (
    todayElem === '木' ? '水' :
    todayElem === '火' ? '木' :
    todayElem === '土' ? '火' :
    todayElem === '金' ? '土' : '金'
  )
  // 母の代表 (陽の干) を使う
  const motherStem: Stem = (
    motherElem === '木' ? '甲' :
    motherElem === '火' ? '丙' :
    motherElem === '土' ? '戊' :
    motherElem === '金' ? '庚' : '壬'
  )
  return COLOR_BY_STEM[motherStem]
}

// ─────────────────────────────────────────────────────────────
// 運勢ランクラベル
// ─────────────────────────────────────────────────────────────
function rankLabel(score: number): string {
  if (score >= 4.6) return '神回'
  if (score >= 4.0) return '絶好調'
  if (score >= 3.3) return '上向き'
  if (score >= 2.6) return 'ふつう'
  if (score >= 2.0) return 'ちょい注意'
  return '休む日'
}

function rankEmoji(score: number): string {
  if (score >= 4.6) return '🔥'
  if (score >= 4.0) return '✨'
  if (score >= 3.3) return '🌤'
  if (score >= 2.6) return '☁️'
  if (score >= 2.0) return '🌧'
  return '⛈'
}

// ─────────────────────────────────────────────────────────────
// 公開: 今日の運勢
// ─────────────────────────────────────────────────────────────
export interface DailyReading {
  // メタ
  todayDateStr: string         // 'YYYY-MM-DD' (JST)
  todayDayStem: Stem
  todayDayBranch: Branch
  userDayStem: Stem
  userDayBranch: Branch
  userMansion: Mansion
  todayMansion: Mansion

  // 算命学パート
  sanmeiRelation: GogyoRel
  sanmeiScore: number          // 1〜5

  // 宿曜パート
  sukuyoRelation: Relation
  sukuyoScore: number          // 1〜5
  sukuyoHeadline: string       // 関係名見出し

  // 総合
  totalScore: number           // 1〜5 (端数あり)
  rank: number                 // round(totalScore) → 1〜5
  rankLabel: string            // "神回" 等
  rankEmoji: string            // 絵文字
  oneLineSummary: string       // "勝負に出ていい日" 等

  // 行動指針
  luckyAction: string
  ngAction: string

  // 色
  luckyColor: { name: string; hex: string }
  escapeColor: { name: string; hex: string }   // ガチ病み回避

  // セリフ
  nyanLine: string
  pochiLine: string
}

function fortuneScore(f: 'great' | string): number {
  switch (f) {
    case '大吉': return 5
    case '吉':   return 4
    case '凶':   return 1
    default:     return 3
  }
}

function pad2(n: number): string { return String(n).padStart(2, '0') }

function todayJST(): { year: number; month: number; day: number; iso: string } {
  // JST 0:00 基準の "今日" を取得
  const now = new Date()
  // 各端末ローカルから UTC を取り、+9h して JST にする
  const jst = new Date(now.getTime() + 9 * 3600 * 1000)
  const y = jst.getUTCFullYear()
  const m = jst.getUTCMonth() + 1
  const d = jst.getUTCDate()
  return { year: y, month: m, day: d, iso: `${y}-${pad2(m)}-${pad2(d)}` }
}

// 今日の日柱を算命学 (sanchu.ts) で算出
function todayDayPillar(t: { year: number; month: number; day: number }): { stem: Stem; branch: Branch } {
  // sanchu.ts の calcSanchu を使う。今日を「ユーザー」として扱い day を取り出す。
  const s = calcSanchu(t.year, t.month, t.day)
  return s.day
}

// (target - self + 27) % 27 と同じ relationOf を再実装 (groupCompat.ts と同様)
function relationFromDistance(d: number): Relation {
  const x = ((d % 27) + 27) % 27
  if (x === 0) return '命'
  const pair = x <= 13 ? x : 27 - x
  switch (pair) {
    case 1:  return '業'
    case 2:  return '栄'
    case 3:  return '衰'
    case 4:  return '安'
    case 5:  return '壊'
    case 6:  return '友'
    case 7:  return '親'
    case 8:  return '危'
    case 9:  return '成'
    case 10: return '業胎'
    case 11: return '栄胎'
    case 12: return '衰胎'
    case 13: return '安胎'
  }
  return '命'
}

// 算命学スコア = 基準スコア +/- 陰陽補正
function sanmeiScore(userStem: Stem, todayStem: Stem): { rel: GogyoRel; score: number } {
  const rel = gogyo(STEM_ELEMENT[userStem], STEM_ELEMENT[todayStem])
  const base = SANMEI_BASE_SCORE[rel]
  const sameYY = STEM_YINYANG[userStem] === STEM_YINYANG[todayStem]
  // 同陰陽は +0.3 (流れがスムーズ)、異陰陽は -0.2 (摩擦あり)
  const adj = sameYY ? 0.3 : -0.2
  const score = Math.max(1, Math.min(5, base + adj))
  return { rel, score }
}

export function buildDailyReading(user: { year: number; month: number; day: number }): DailyReading {
  const t = todayJST()
  // 算命学パート
  const userSanchu = calcSanchu(user.year, user.month, user.day)
  const todayPillar = todayDayPillar(t)
  const sm = sanmeiScore(userSanchu.day.stem, todayPillar.stem)

  // 宿曜パート
  const userMansion = mansionOf(user.year, user.month, user.day)
  const todayMansion = mansionOf(t.year, t.month, t.day)
  const distance = (mansionIndex(todayMansion) - mansionIndex(userMansion) + 27) % 27
  const relation = relationFromDistance(distance)
  const relTmpl = RELATION_TEMPLATES[relation]
  const sukuyoSc = fortuneScore(relTmpl.fortune)

  // 総合 = 算命学 60% + 宿曜 40% (算命学が日々の主軸、宿曜は色付け)
  const total = sm.score * 0.6 + sukuyoSc * 0.4
  const rank = Math.max(1, Math.min(5, Math.round(total)))

  // セリフ生成 (テンプレベース)
  const nyanLine = buildNyanLine(sm.rel, total)
  const pochiLine = buildPochiLine(sm.rel, total)

  return {
    todayDateStr: t.iso,
    todayDayStem: todayPillar.stem,
    todayDayBranch: todayPillar.branch,
    userDayStem: userSanchu.day.stem,
    userDayBranch: userSanchu.day.branch,
    userMansion, todayMansion,
    sanmeiRelation: sm.rel,
    sanmeiScore: sm.score,
    sukuyoRelation: relation,
    sukuyoScore: sukuyoSc,
    sukuyoHeadline: relTmpl.headline,
    totalScore: total,
    rank,
    rankLabel: rankLabel(total),
    rankEmoji: rankEmoji(total),
    oneLineSummary: SANMEI_LABEL[sm.rel],
    luckyAction: LUCKY_ACTION[sm.rel],
    ngAction: NG_ACTION[sm.rel],
    luckyColor: COLOR_BY_STEM[todayPillar.stem],
    escapeColor: escapeColorOf(todayPillar.stem),
    nyanLine, pochiLine,
  }
}

// ─────────────────────────────────────────────────────────────
// セリフテンプレ (関係 × 運勢で出し分け)
// ─────────────────────────────────────────────────────────────
function buildNyanLine(rel: GogyoRel, total: number): string {
  const tone: 'high' | 'mid' | 'low' = total >= 4 ? 'high' : total >= 2.5 ? 'mid' : 'low'
  const table: Record<GogyoRel, Record<typeof tone, string>> = {
    '比和': {
      high: '今日のあんた、無理にテンション上げなくても勝手にいい流れ来てるよ。気付いてる?',
      mid:  '可もなく不可もなく。今日は無難に立ち回るのが正解だね。',
      low:  '今日は周りに合わせすぎると消耗するよ。1 人時間を確保しな。',
    },
    '我生': {
      high: '今日のあんた、言葉が刺さる日。SNSでつぶやくのも、好きな人にDM送るのもアリ。',
      mid:  '発信しても反応は普通。「届く相手」に絞って動くと吉。',
      low:  '発信したい欲はあるけど空回り注意。下書きに留めるくらいで。',
    },
    '我剋': {
      high: '勝負日来てる。テスト・面接・告白、迷ってるやつ今日突っ込んじゃえ。',
      mid:  '攻めれば取れる場面もあるけど、相手の出方は見たほうがいい日。',
      low:  '今日押すと折れる相手出るよ。攻撃モードはオフで。',
    },
    '剋我': {
      high: '逆風だけど運勢自体はそんな悪くない。受け流せばOK。',
      mid:  '今日は守りの日。新しいことより、いつもの動きでいこう。',
      low:  'ぶっちゃけ今日はしんどい日。無理に動かないで温存して。',
    },
    '生我': {
      high: '受け取り上手な日。年上から声かけてもらえたら素直に乗ろう。',
      mid:  '誰かに頼っていい日。「自分でやる」プライドは今日は捨てな。',
      low:  '自分で抱え込むと潰れる日。誰かに弱音吐いて。',
    },
  }
  return table[rel][tone]
}

function buildPochiLine(rel: GogyoRel, total: number): string {
  const tone: 'high' | 'mid' | 'low' = total >= 4 ? 'high' : total >= 2.5 ? 'mid' : 'low'
  if (tone === 'high') return 'あんたの良さが活きる日だワン！自信持ってGOだワン！'
  if (tone === 'mid')  return '焦らずマイペースで大丈夫だワン！小さな良いことに気付ける日だワン！'
  return '今日は無理しないで！ポチがそばにいるワン！明日があるワン！'
}

// ─────────────────────────────────────────────────────────────
// シェア文 (LINE/X)
// ─────────────────────────────────────────────────────────────
export function dailyShareText(name: string, r: DailyReading): string {
  return `🔮 #うらにゃん  ${r.todayDateStr} の運勢\n` +
    `${name}: ${r.rankEmoji} ${r.rankLabel} (★${r.rank}/5)\n` +
    `${r.oneLineSummary}\n` +
    `🎨 ラッキー: ${r.luckyColor.name}\n` +
    `🐱「${r.nyanLine}」`
}

// テスト用
export const __test = { gogyo, sanmeiScore, escapeColorOf, todayDayPillar, todayJST }
// 不使用警告対策
void STEMS; void BRANCHES
