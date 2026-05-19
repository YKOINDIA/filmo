// ============================================================
// うらにゃん。: 宿曜 相性診断 セリフテンプレ
// ============================================================
// 2 人の 宿 の距離 d = (target - self + 27) mod 27 を
// 14 関係 (命 / 業 / 栄 / 衰 / 安 / 壊 / 友 / 親 / 危 / 成 / 4 つの胎) に分類。
// 各関係に {見出し, 吉凶, 解説, ニャン, ポチ, アドバイス} を持たせる。
//
// 命: d=0
// 業:   d=1, 26
// 栄:   d=2, 25  (吉)
// 衰:   d=3, 24  (凶)
// 安:   d=4, 23  (吉)
// 壊:   d=5, 22  (凶)
// 友:   d=6, 21  (吉)
// 親:   d=7, 20  (吉)
// 危:   d=8, 19  (凶)
// 成:   d=9, 18  (大吉)
// 業胎: d=10, 17
// 栄胎: d=11, 16
// 衰胎: d=12, 15
// 安胎: d=13, 14

import { type Mansion, MANSIONS, mansionOf, mansionIndex } from './sukuyo'

export type Relation =
  | '命' | '業' | '栄' | '衰' | '安' | '壊' | '友' | '親' | '危' | '成'
  | '業胎' | '栄胎' | '衰胎' | '安胎'

export type Fortune = '大吉' | '吉' | '中' | '凶'

export interface RelationTemplate {
  headline: string       // "鏡合わせの二人" のような見出し
  fortune: Fortune
  blurb: string          // 1〜2 行説明
  nyan: string           // ニャンじろうの観察セリフ
  pochi: string          // ポチのフォローセリフ
  advice: string         // 短いアドバイス
}

// ─────────────────────────────────────────────────────────────
// 距離 → 関係
// ─────────────────────────────────────────────────────────────
function relationOf(distance: number): Relation {
  const d = ((distance % 27) + 27) % 27
  if (d === 0) return '命'
  // pair mapping
  const pair = d <= 13 ? d : 27 - d   // pair 1..13
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
  // 未到達想定
  return '命'
}

// ─────────────────────────────────────────────────────────────
// 関係ごとのテンプレ
// ─────────────────────────────────────────────────────────────
export const RELATION_TEMPLATES: Record<Relation, RelationTemplate> = {
  '命': {
    headline: '鏡合わせの二人',
    fortune: '中',
    blurb: '生まれた星が同じ。良くも悪くも似たもの同士で、自分を見てるみたいになる関係。',
    nyan: 'あんたら宿が同じ。気付かない? 喋ってるとなんか自分と話してる気分になるでしょ。',
    pochi: '価値観が合うから一緒にいて疲れないワン！似てるから安心できる相手だワン！',
    advice: '違いを認め合う努力をすると、もっと深い関係になれる。',
  },
  '業': {
    headline: '腐れ縁ペア',
    fortune: '中',
    blurb: '前世から続く深い縁。喧嘩しても結局くっつく、運命的に引き合うタイプ。',
    nyan: '何回切ろうとしても切れないやつでしょ、それ。ぶっちゃけ前世絡みの縁あるよ。',
    pochi: '深い絆で結ばれてるってことだワン！長い目で見ると人生のキーパーソンだワン！',
    advice: '近すぎると疲れるから、たまに距離を取ると関係が長持ちする。',
  },
  '栄': {
    headline: 'お互いを輝かせるペア',
    fortune: '吉',
    blurb: '一緒にいると相手がキラキラする。SNS で並ぶと「映える」コンビ。',
    nyan: 'あんたら並んでる写真、絶対映えてるでしょ。組むと両方ともレベル上がる感じあるよ。',
    pochi: 'お互いの良いところを引き出し合えるワン！最高の相棒関係だワン！',
    advice: '勉強・趣味・推し活、共通の目標を持つとさらに伸びる。',
  },
  '衰': {
    headline: '消耗しがちペア',
    fortune: '凶',
    blurb: '片方がエネルギーを吸い取られがち。気付くと「なんか疲れる」関係に。',
    nyan: 'あんた、その子と会った後ぐったりすること多くない? 一方通行になりがちだよ。',
    pochi: 'お互いの良さを見つめ直す時期かもしれないワン！距離感を見直してみるワン！',
    advice: '無理して合わせない。会う頻度を減らすか、対等になる工夫を。',
  },
  '安': {
    headline: '安心ペア',
    fortune: '吉',
    blurb: '一緒にいると落ち着く。長続きする友達・パートナー向けの組み合わせ。',
    nyan: 'その子と居る時、テンション高くなくね? でもそれが正解。"普通"が長続きの秘訣だよ。',
    pochi: '安心できる相手って人生の宝物だワン！静かに支え合える関係だワン！',
    advice: '刺激は外で求めて、関係そのものは「居心地の良さ」を大事にして。',
  },
  '壊': {
    headline: '要注意ペア',
    fortune: '凶',
    blurb: '宿曜的にはワーストの組み合わせ。価値観がズレやすく、衝突しがち。',
    nyan: 'ハッキリ言うわ。あんたらの組み合わせ、宿曜的に最悪のやつ。すれ違いの天才だよ。',
    pochi: '違いを面白がれる関係になれたら、逆に最強になれるワン！希望はあるワン！',
    advice: 'グループの中で会うくらいがちょうどいい。深入りは慎重に。',
  },
  '友': {
    headline: 'ベスフレ確定ペア',
    fortune: '吉',
    blurb: '友達として最高の組み合わせ。何年経っても LINE が続くタイプ。',
    nyan: 'その子、一生付き合うやつだよ。10 年後もインスタで近況見てる関係になるね。',
    pochi: '本物の友達がいる人生は強いワン！大切にしてほしい関係だワン！',
    advice: '恋愛に進めるよりは "友達ポジション" のままが互いに気楽。',
  },
  '親': {
    headline: '家族みたいなペア',
    fortune: '吉',
    blurb: '血が繋がってないのに家族感ある関係。深い信頼で結ばれる。',
    nyan: 'あんたらほぼ家族でしょ。実家みたいな安心感あるって思われてるよ、お互いに。',
    pochi: '血より濃い絆って存在するんだワン！どこまでも信頼できる相手だワン！',
    advice: '甘えすぎ注意。当たり前にしないで、たまには感謝を言葉で。',
  },
  '危': {
    headline: 'ヒヤヒヤペア',
    fortune: '凶',
    blurb: '誤解されやすい組み合わせ。良かれと思った言動が裏目に出がち。',
    nyan: 'その子に対して、「あれ伝わってるはず」って思ってる時 9 割伝わってないから注意。',
    pochi: '言葉にして伝える勇気が大事だワン！お互い大切に思ってるはずだワン！',
    advice: '察し合いをやめて、ちゃんと言葉で確認する習慣をつけて。',
  },
  '成': {
    headline: '最強の相棒ペア',
    fortune: '大吉',
    blurb: '何かを一緒に成し遂げるための組み合わせ。文化祭・部活・将来の相棒に。',
    nyan: '出ました大当たり。あんたら組むと無敵だよ。何か一緒にプロジェクトやってみ?',
    pochi: '宇宙レベルで応援したくなる関係だワン！可能性無限大だワン！',
    advice: 'チームで何かやる時に組むと結果が出る。学園祭・受験勉強・副業 etc。',
  },
  '業胎': {
    headline: '影の縁',
    fortune: '中',
    blurb: '表面的には薄い縁だけど、要所要所で人生に絡んでくる隠れた関係。',
    nyan: 'その子、いつもの友達リストには入ってないけど、節目で必ず出てくるタイプじゃない?',
    pochi: '見えないところで繋がってるご縁だワン！大事にすると吉だワン！',
    advice: 'たまに連絡を取るくらいで丁度いい。深追いしなくて OK。',
  },
  '栄胎': {
    headline: 'ちょい運アップペア',
    fortune: '吉',
    blurb: '栄ペアの弱め版。一緒にいるとちょっとずつ運が上向く穏やか吉。',
    nyan: 'その子と居ると、地味〜に良いことが起きるでしょ。派手じゃないけど効果あり。',
    pochi: 'じんわり効く幸運の魔法だワン！穏やかな上昇気流に乗れるワン！',
    advice: 'カフェやお出かけのお供にどうぞ。重い話より軽い遊びで吉。',
  },
  '衰胎': {
    headline: 'ちょい疲れペア',
    fortune: '中',
    blurb: '衰ペアの弱め版。一緒にいて時々モヤッとする、嫌いじゃないけど…な関係。',
    nyan: '別に嫌いじゃないけど、なんか会った後微妙に気分下がること、あるよね。',
    pochi: 'モヤッとする時は無理せず、自分のペースを優先するワン！',
    advice: '長時間 2 人きりは避けて、グループで会うのがおすすめ。',
  },
  '安胎': {
    headline: 'ぼちぼち穏やかペア',
    fortune: '中',
    blurb: '安ペアの弱め版。可も不可もない、平和に共存できる関係。',
    nyan: 'その子と居ても特に盛り上がらないけど、ストレスもないでしょ。それも才能。',
    pochi: '居心地のいい "いつものメンバー" の一人だワン！',
    advice: '無理に距離を縮める必要はなし。今のままが正解。',
  },
}

// ─────────────────────────────────────────────────────────────
// 公開: 2 人の生年月日 → 相性結果
// ─────────────────────────────────────────────────────────────
export interface CompatibilityReading {
  selfMansion: Mansion
  targetMansion: Mansion
  distance: number               // (target - self + 27) % 27
  relation: Relation
  template: RelationTemplate
}

export function buildCompatibilityReading(
  self:   { year: number; month: number; day: number },
  target: { year: number; month: number; day: number },
): CompatibilityReading {
  const sm = mansionOf(self.year,   self.month,   self.day)
  const tm = mansionOf(target.year, target.month, target.day)
  const d = (mansionIndex(tm) - mansionIndex(sm) + 27) % 27
  const rel = relationOf(d)
  return {
    selfMansion: sm,
    targetMansion: tm,
    distance: d,
    relation: rel,
    template: RELATION_TEMPLATES[rel],
  }
}

export const __test = { relationOf }
// MANSIONS の参照を残す (タイポチェック用)
void MANSIONS
