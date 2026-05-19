// ============================================================
// うらにゃん。: ファッション占い (運命の勝ち服系統)
// ============================================================
// ロジック:
//   - 中央主星 (算命学 陽占) → 系統 (10 種)
//   - 日干の五行 → カラーパレット 3 色
//   - 日支 → アクセント アイテム
//
// 結果: 系統見出し + 勝ち服 3 つ + NG 服装 + アクセント + パレット +
// 今週の合言葉 (ニャン+ポチ)。

import type { Stem, Branch, Sanchu } from './sanchu'
import { calcSanchu } from './sanchu'
import { deriveThreeStars, type MainStar } from './sanmei'

type Element = '木' | '火' | '土' | '金' | '水'
const STEM_ELEMENT: Record<Stem, Element> = {
  '甲': '木', '乙': '木', '丙': '火', '丁': '火',
  '戊': '土', '己': '土', '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
}

// ─────────────────────────────────────────────────────────────
// 系統 (10 主星 → 10 系統)
// ─────────────────────────────────────────────────────────────
export interface StyleProfile {
  headline: string             // 例: "シンプル・アメカジ系"
  vibe: string                 // 1 行説明
  winItems: string[]           // 勝ち服 3 つ
  ngItems: string[]            // NG 服装 1〜2 つ
  weeklyMantra: string         // 今週の合言葉 (短)
}

const STYLE_BY_STAR: Record<MainStar, StyleProfile> = {
  '貫索星': {
    headline: 'シンプル・アメカジ系',
    vibe: '頑固にマイペースな芯が、ベーシックの完璧な着こなしに出る',
    winItems: ['白Tシャツ', 'リジッドデニム', '無地スウェット'],
    ngItems: ['流行りに飛びついた派手柄'],
    weeklyMantra: '今週は「変えない」が正解。',
  },
  '石門星': {
    headline: 'カジュアル・ストリート系',
    vibe: '誰とでも馴染む着こなしで、グループの空気を作る',
    winItems: ['オーバーサイズスウェット', 'ワイドパンツ', 'ロゴキャップ'],
    ngItems: ['身体ラインが出すぎる服'],
    weeklyMantra: 'リラックス感が信頼を呼ぶ週。',
  },
  '鳳閣星': {
    headline: 'ナチュラル・リラックス系',
    vibe: '無理してない服が、なぜか一番似合う日',
    winItems: ['リネンシャツ', 'ストレートデニム', 'スニーカー'],
    ngItems: ['締め付け系・きっちりスーツ風'],
    weeklyMantra: '楽な服が運を呼ぶ。',
  },
  '調舒星': {
    headline: 'モード・個性派系',
    vibe: '繊細な感覚が際立つ、独自のシルエットを選ぶ日',
    winItems: ['アシンメトリーカット', 'モノトーンレイヤード', 'こだわり小物'],
    ngItems: ['量産型のテンプレコーデ'],
    weeklyMantra: '人と違うことを恐れない週。',
  },
  '禄存星': {
    headline: 'フェミニン・ガーリー系',
    vibe: '愛されオーラ MAX。柔らかく可愛い系がハマる',
    winItems: ['ふんわりブラウス', 'プリーツスカート', 'パール小物'],
    ngItems: ['ミリタリー・無骨すぎる服'],
    weeklyMantra: '甘さは武器。隠さない。',
  },
  '司禄星': {
    headline: 'きれいめ・コンサバ系',
    vibe: '堅実派の品格が、きちんと感ある着こなしに出る',
    winItems: ['ニットカーディガン', 'ストレートパンツ', 'ローファー'],
    ngItems: ['ダメージ加工・ボロ加工'],
    weeklyMantra: 'TPO に勝るオシャレなし。',
  },
  '車騎星': {
    headline: 'スポーティ・ストリート系',
    vibe: 'アクティブな印象が今週の運を引き寄せる',
    winItems: ['ジャージセットアップ', 'ハイカットスニーカー', 'キャップ'],
    ngItems: ['ヒール・タイトすぎる服'],
    weeklyMantra: '動ける服 = 攻められる週。',
  },
  '牽牛星': {
    headline: 'きちんと・トラッド系',
    vibe: 'プライドの高さが、品のある服選びとして輝く',
    winItems: ['ジャケット', 'プリーツスカート/スラックス', 'シンプルパンプス'],
    ngItems: ['だらしないシルエット'],
    weeklyMantra: '凛とした姿勢が運を呼ぶ。',
  },
  '龍高星': {
    headline: '古着・エスニック系',
    vibe: '誰にも真似できない独自セレクトが光る週',
    winItems: ['ヴィンテージシャツ', 'エスニック柄スカート', '個性的アクセ'],
    ngItems: ['みんなが持ってる定番ブランド'],
    weeklyMantra: '人と被ったら負け。',
  },
  '玉堂星': {
    headline: 'クラシカル・きれいめ系',
    vibe: '知性が滲む正統派の着こなしが運勢を上げる',
    winItems: ['カーディガン×ブラウス', 'タイトスカート', 'メガネ'],
    ngItems: ['ロックすぎる派手柄'],
    weeklyMantra: '上品な知性が勝つ週。',
  },
}

// ─────────────────────────────────────────────────────────────
// カラーパレット (五行 → 3 色)
// ─────────────────────────────────────────────────────────────
const COLOR_PALETTE_BY_ELEMENT: Record<Element, Array<{ name: string; hex: string }>> = {
  '木': [
    { name: 'フォレストグリーン', hex: '#2E7D5F' },
    { name: 'ライムグリーン',     hex: '#A8DC68' },
    { name: 'カーキ',             hex: '#7D7B4A' },
  ],
  '火': [
    { name: 'バーガンディ',       hex: '#7E2C3C' },
    { name: 'コーラル',           hex: '#FF8B7A' },
    { name: 'ビビッドオレンジ',   hex: '#FF7A45' },
  ],
  '土': [
    { name: 'キャメル',           hex: '#C19A6B' },
    { name: 'ベージュ',           hex: '#E8D6B7' },
    { name: 'ブラウン',           hex: '#6F4A2E' },
  ],
  '金': [
    { name: 'パールホワイト',     hex: '#F8F4EC' },
    { name: 'シルバーグレー',     hex: '#C0C0C8' },
    { name: 'ペールピンク',       hex: '#FFC8DD' },
  ],
  '水': [
    { name: 'ディープネイビー',   hex: '#1F2A55' },
    { name: 'デニムブルー',       hex: '#4A6FA5' },
    { name: 'ブラック',           hex: '#1A1612' },
  ],
}

// ─────────────────────────────────────────────────────────────
// アクセントアイテム (日支 → 1 種)
// ─────────────────────────────────────────────────────────────
const ACCENT_BY_BRANCH: Record<Branch, string> = {
  '子': '帽子・ヘアアクセサリー',
  '丑': 'ローファー・革小物',
  '寅': 'ベルト・大ぶりバングル',
  '卯': 'フリル・リボン',
  '辰': 'シルバーアクセサリー',
  '巳': 'スカーフ・チェーン',
  '午': 'ロゴT・派手プリント',
  '未': 'ふんわり素材 (モヘア・ファー)',
  '申': '機能的トートバッグ',
  '酉': 'パール・カチッとしたアクセ',
  '戌': 'スニーカー',
  '亥': '鉄板アイテム (デニム・白T)',
}

// ─────────────────────────────────────────────────────────────
// 掛け合いセリフ (系統別)
// ─────────────────────────────────────────────────────────────
function nyanLine(star: MainStar): string {
  return ({
    '貫索星': 'あんた、流行り追っかけても似合わないでしょ。シンプル極めた方が絶対勝てる。',
    '石門星': 'あんた、馴染む服選ぶの天才。だから無理してド派手着るとちぐはぐになるよ。',
    '鳳閣星': 'あんた、楽な服しか勝たない。きちんとした服のときの違和感、自分でも気付いてる?',
    '調舒星': 'みんなと一緒の服着てる時のあんた、表情死んでるよ。個性出していこ。',
    '禄存星': 'あんた、甘い服似合うのに「ガーリーは恥ずかしい」とか言いがち。それ運落としてるよ。',
    '司禄星': 'あんた、ちゃんとした服が一番映える。ダメージ加工とか今週はマジでやめときな。',
    '車騎星': '今週のあんたは動ける服が正解。ヒールとか履いた瞬間に運落ちるから。',
    '牽牛星': 'あんた、きちんとしてないと自分でしっくり来ないでしょ。今週は背筋伸ばす服で。',
    '龍高星': 'あんた、量産型コーデ着てる日は運も量産型になるよ。古着とか冒険して。',
    '玉堂星': 'あんた、知的に見える服の方が褒められるでしょ。今週はメガネ+きれいめで。',
  } as Record<MainStar, string>)[star]
}

function pochiLine(star: MainStar): string {
  return ({
    '貫索星': 'シンプルが一番輝くって最高だワン！長く着られるアイテムを大事にだワン！',
    '石門星': 'みんなと馴染める服選びの上手さは本当の才能だワン！',
    '鳳閣星': '楽な服でも垢抜けて見えるのは才能だワン！',
    '調舒星': '個性を恐れずに見せていいワン！あんたのセンスは光ってるワン！',
    '禄存星': '甘めスタイルが似合うのは愛されオーラの証だワン！自信持ってだワン！',
    '司禄星': 'きちんと感は信頼の象徴だワン！品があるって最強だワン！',
    '車騎星': 'アクティブなあんたが一番輝くワン！スポーティーで攻めるワン！',
    '牽牛星': '上品な凛とした姿が運を呼ぶワン！自分らしくキメるワン！',
    '龍高星': '人と違うセンスは才能だワン！古着屋巡りも運命の出会いだワン！',
    '玉堂星': '知性が滲むコーデは魅力的だワン！きれいめで上品にいくワン！',
  } as Record<MainStar, string>)[star]
}

// ─────────────────────────────────────────────────────────────
// 公開: ファッション占い結果
// ─────────────────────────────────────────────────────────────
export interface FashionReading {
  star: MainStar                  // 中央主星
  style: StyleProfile
  palette: Array<{ name: string; hex: string }>  // 3 色
  paletteElement: Element         // 五行
  accent: string                  // 日支アクセント
  nyanLine: string
  pochiLine: string
  sanchu: Sanchu
}

export function buildFashionReading(birth: { year: number; month: number; day: number }): FashionReading {
  const sanchu = calcSanchu(birth.year, birth.month, birth.day)
  const stars = deriveThreeStars(sanchu)
  // 中央主星 = 性格の核 = 服装にも出る
  const star = stars.center
  const element = STEM_ELEMENT[sanchu.day.stem]
  return {
    star,
    style: STYLE_BY_STAR[star],
    palette: COLOR_PALETTE_BY_ELEMENT[element],
    paletteElement: element,
    accent: ACCENT_BY_BRANCH[sanchu.day.branch],
    nyanLine: nyanLine(star),
    pochiLine: pochiLine(star),
    sanchu,
  }
}

export function fashionShareText(name: string, r: FashionReading): string {
  return `👗 #うらにゃん  ファッション占い\n` +
    `${name} の勝ち服系統: ${r.style.headline}\n` +
    `「${r.style.weeklyMantra}」\n` +
    `🏆 ${r.style.winItems.slice(0, 2).join(' / ')}\n` +
    `🎨 ${r.palette.map(c => c.name).join(' × ')}`
}
