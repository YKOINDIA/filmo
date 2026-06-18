// ============================================================
// 映画好き診断: タイプ定義とマッチングロジック
// ============================================================
// 質問への回答を「タグベクトル」として集計し、各診断タイプの
// 重みベクトルとのコサイン類似度で最も近いタイプを判定する。
// おすすめ映画は各タイプに手動キュレーションした TMDB ID。
// (ID はすべて映画 = type: 'movie')

export type DiagnosisTag =
  | 'sf'
  | 'action'
  | 'human'
  | 'mystery'
  | 'romance'
  | 'comedy'
  | 'horror'
  | 'fantasy'
  | 'anime'
  | 'art'
  | 'classic'

export type TagWeights = Partial<Record<DiagnosisTag, number>>

export interface RecommendedMovie {
  id: number // TMDB movie id
  title: string // フォールバック表示用 (TMDB 取得失敗時)
}

export interface DiagnosisType {
  id: string // URL スラッグ (result/[type])
  name: string // 「知的SF探究家タイプ」など
  emoji: string
  /** SNS シェア・OG 用の短いキャッチコピー */
  tagline: string
  /** 結果画面の説明文 (2〜3 文) */
  description: string
  /** 配色 (グラデーション・OG 背景に使用) */
  color: string
  accent: string
  /** タイプを特徴づけるタグ重み */
  weights: TagWeights
  /** おすすめ映画 (TMDB movie id) */
  recommendations: RecommendedMovie[]
}

export const DIAGNOSIS_TYPES: DiagnosisType[] = [
  {
    id: 'intellectual-sf',
    name: '知的SF探究家タイプ',
    emoji: '🛰️',
    tagline: '静謐な思索の宇宙を旅する人',
    description:
      '派手さよりも「問い」を残す作品に惹かれるタイプ。緻密な設定と知的な余韻を味わうのが何より好きで、観終わったあとも頭の中で物語が続いています。',
    color: '#1b2a4a',
    accent: '#6cf2ff',
    weights: { sf: 3, art: 2, classic: 1 },
    recommendations: [
      { id: 329865, title: 'メッセージ' },
      { id: 264660, title: 'エクス・マキナ' },
      { id: 782, title: 'ガタカ' },
    ],
  },
  {
    id: 'cosmic-visionary',
    name: '宇宙ロマン・ビジョナリータイプ',
    emoji: '🌌',
    tagline: '壮大なスケールに胸が震える夢想家',
    description:
      'スクリーンいっぱいに広がる世界観と、想像を超えるビジュアルに心を奪われるタイプ。「人類とは」「宇宙とは」を体感させてくれる大作にロマンを感じます。',
    color: '#0e1630',
    accent: '#8a7bff',
    weights: { sf: 3, fantasy: 2, action: 1 },
    recommendations: [
      { id: 157336, title: 'インターステラー' },
      { id: 335984, title: 'ブレードランナー 2049' },
      { id: 62, title: '2001年宇宙の旅' },
    ],
  },
  {
    id: 'royal-hero',
    name: '王道アクション・ヒーロータイプ',
    emoji: '🦸',
    tagline: '王道のかっこよさに痺れる人',
    description:
      'ヒーローの覚悟、息をのむアクション、そしてカタルシス。王道を王道として全力で楽しめるタイプで、観たあとは思わず誰かに語りたくなります。',
    color: '#2a1a10',
    accent: '#ff9f43',
    weights: { action: 3, human: 1, sf: 1 },
    recommendations: [
      { id: 361743, title: 'トップガン マーヴェリック' },
      { id: 155, title: 'ダークナイト' },
      { id: 353081, title: 'ミッション:インポッシブル/フォールアウト' },
    ],
  },
  {
    id: 'adrenaline-junkie',
    name: 'アドレナリン中毒アクションタイプ',
    emoji: '🔥',
    tagline: '理屈抜きでブッ飛ばしたい人',
    description:
      'とにかく爽快感とスピード感！考えるより前に体が乗ってしまう、純度100%のエンタメ派。最初から最後までアクセル全開な作品が大好物です。',
    color: '#2a0f12',
    accent: '#ff5757',
    weights: { action: 3, comedy: 1 },
    recommendations: [
      { id: 76341, title: 'マッドマックス 怒りのデス・ロード' },
      { id: 245891, title: 'ジョン・ウィック' },
      { id: 562, title: 'ダイ・ハード' },
    ],
  },
  {
    id: 'heart-drama',
    name: '心ふるえる感動ヒューマンドラマ派',
    emoji: '🌱',
    tagline: '人の生き様に心を動かされる人',
    description:
      '登場人物の人生にそっと寄り添い、その歩みに涙し勇気をもらうタイプ。観るたびに「自分も頑張ろう」と前を向ける、そんな映画体験を大切にしています。',
    color: '#11241a',
    accent: '#7bed9f',
    weights: { human: 3, classic: 1 },
    recommendations: [
      { id: 278, title: 'ショーシャンクの空に' },
      { id: 13, title: 'フォレスト・ガンプ/一期一会' },
      { id: 490132, title: 'グリーンブック' },
    ],
  },
  {
    id: 'life-anthem',
    name: '涙腺崩壊・人生賛歌タイプ',
    emoji: '🕯️',
    tagline: '泣くために映画を観る人',
    description:
      '愛おしい人生の輝きを描いた作品に、思いきり涙したいタイプ。切なさも温かさもまるごと味わって、観終わったあとの余韻に長く浸るのが幸せです。',
    color: '#221426',
    accent: '#ff7aae',
    weights: { human: 3, romance: 1, classic: 1 },
    recommendations: [
      { id: 637, title: 'ライフ・イズ・ビューティフル' },
      { id: 11216, title: 'ニュー・シネマ・パラダイス' },
      { id: 11036, title: 'きみに読む物語' },
    ],
  },
  {
    id: 'mystery-addict',
    name: '頭脳派サスペンス中毒タイプ',
    emoji: '🔎',
    tagline: '張りつめた緊張感が好物な人',
    description:
      '一瞬も気が抜けない緊張感と、張り巡らされた伏線にゾクゾクするタイプ。犯人や真相を自分でも推理しながら、最後まで手に汗握って楽しみます。',
    color: '#1a1d2a',
    accent: '#c0c8ff',
    weights: { mystery: 3, art: 1 },
    recommendations: [
      { id: 807, title: 'セブン' },
      { id: 629, title: 'ユージュアル・サスペクツ' },
      { id: 1124, title: 'プレステージ' },
    ],
  },
  {
    id: 'twist-hunter',
    name: 'どんでん返しハンタータイプ',
    emoji: '🌀',
    tagline: '裏切られるほど興奮する人',
    description:
      'ラストでひっくり返される快感を求めて映画を観るタイプ。「そう来たか！」と膝を打つ瞬間がたまらず、構成の妙にこそ最高の映画を感じます。',
    color: '#15212a',
    accent: '#4fd1c5',
    weights: { mystery: 3, art: 2 },
    recommendations: [
      { id: 496243, title: 'パラサイト 半地下の家族' },
      { id: 210577, title: 'ゴーン・ガール' },
      { id: 77, title: 'メメント' },
    ],
  },
  {
    id: 'youth-romantic',
    name: '切ない青春ロマンチストタイプ',
    emoji: '💫',
    tagline: '胸の奥がきゅっとする恋に弱い人',
    description:
      '報われない想いや、過ぎゆく時間の切なさに心を寄せるタイプ。美しい音楽と情景の中で描かれる恋に、いつまでも余韻を引きずってしまいます。',
    color: '#1d1730',
    accent: '#b08bff',
    weights: { romance: 3, art: 1 },
    recommendations: [
      { id: 313369, title: 'ラ・ラ・ランド' },
      { id: 38, title: 'エターナル・サンシャイン' },
      { id: 597, title: 'タイタニック' },
    ],
  },
  {
    id: 'love-story',
    name: 'ときめきラブストーリー大好きタイプ',
    emoji: '💕',
    tagline: 'しあわせな気持ちになりたい人',
    description:
      '観終わったあとに思わず笑顔になる、心あたたまる恋物語が大好きなタイプ。ときめきと幸福感に包まれたくて、何度でも観返してしまいます。',
    color: '#2a1320',
    accent: '#ff8ec7',
    weights: { romance: 3, comedy: 2 },
    recommendations: [
      { id: 509, title: 'ノッティングヒルの恋人' },
      { id: 122906, title: 'アバウト・タイム〜愛おしい時間について〜' },
      { id: 114, title: 'プリティ・ウーマン' },
    ],
  },
  {
    id: 'feelgood-entertainer',
    name: '笑って泣ける痛快エンタメ派',
    emoji: '🍿',
    tagline: '映画館でいちばん楽しみたい人',
    description:
      '笑いも涙も興奮も、エンタメの楽しさをまるごと味わいたいタイプ。観終わったあとに「最高だった！」と言える、幸福度の高い作品を求めています。',
    color: '#2a2110',
    accent: '#ffd24a',
    weights: { comedy: 2, action: 2, human: 1 },
    recommendations: [
      { id: 105, title: 'バック・トゥ・ザ・フューチャー' },
      { id: 316029, title: 'グレイテスト・ショーマン' },
      { id: 424694, title: 'ボヘミアン・ラプソディ' },
    ],
  },
  {
    id: 'thrill-seeker',
    name: 'ゾクゾク・ホラースリル愛好家',
    emoji: '👻',
    tagline: '怖いほど夢中になれる人',
    description:
      '背筋が凍るような恐怖や不穏な空気に、むしろ高揚するタイプ。じわじわ追い詰められる感覚を楽しみ、観終わったあとの余韻すら味わいます。',
    color: '#0f1414',
    accent: '#8be28b',
    weights: { horror: 3, mystery: 1 },
    recommendations: [
      { id: 493922, title: 'ヘレディタリー/継承' },
      { id: 419430, title: 'ゲット・アウト' },
      { id: 138843, title: '死霊館' },
    ],
  },
  {
    id: 'fantasy-adventurer',
    name: '夢と冒険のファンタジー冒険者タイプ',
    emoji: '🗺️',
    tagline: '異世界の扉を開けたい人',
    description:
      '現実を離れ、壮大な冒険と魔法の世界に浸りたいタイプ。緻密に作り込まれた世界観に旅をするように没入し、ワクワクが止まりません。',
    color: '#152012',
    accent: '#9cd66b',
    weights: { fantasy: 3, action: 1, classic: 1 },
    recommendations: [
      { id: 120, title: 'ロード・オブ・ザ・リング/旅の仲間' },
      { id: 671, title: 'ハリー・ポッターと賢者の石' },
      { id: 1417, title: 'パンズ・ラビリンス' },
    ],
  },
  {
    id: 'anime-poet',
    name: 'アニメ・ビジュアル詩人タイプ',
    emoji: '🎐',
    tagline: '映像の美しさに息をのむ人',
    description:
      '繊細な作画と空気感、音楽が織りなす一瞬の美しさに心を奪われるタイプ。物語だけでなく「映像そのもの」を味わえる感性の持ち主です。',
    color: '#101d2a',
    accent: '#6cc6ff',
    weights: { anime: 3, romance: 1, fantasy: 1 },
    recommendations: [
      { id: 372058, title: '君の名は。' },
      { id: 129, title: '千と千尋の神隠し' },
      { id: 508883, title: '君たちはどう生きるか' },
    ],
  },
  {
    id: 'cinephile',
    name: '孤高のシネフィル・名作探究家タイプ',
    emoji: '🎞️',
    tagline: '映画史の深みを愛する人',
    description:
      '流行よりも、時代を超えて愛される名作にこそ価値を感じるタイプ。一本の映画を通して映画史や表現そのものを味わう、筋金入りの映画通です。',
    color: '#1a1712',
    accent: '#e0c089',
    weights: { art: 2, classic: 3, human: 1 },
    recommendations: [
      { id: 238, title: 'ゴッドファーザー' },
      { id: 346, title: '七人の侍' },
      { id: 62, title: '2001年宇宙の旅' },
    ],
  },
]

export function getTypeById(id: string | undefined | null): DiagnosisType | undefined {
  if (!id) return undefined
  return DIAGNOSIS_TYPES.find(t => t.id === id)
}

const ALL_TAGS: DiagnosisTag[] = [
  'sf', 'action', 'human', 'mystery', 'romance', 'comedy', 'horror', 'fantasy', 'anime', 'art', 'classic',
]

function toVector(w: TagWeights): number[] {
  return ALL_TAGS.map(t => w[t] ?? 0)
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/**
 * 集計済みのタグスコアから最も近い診断タイプを返す。
 * スコアが全 0 のときは先頭タイプにフォールバック。
 * 同点時は DIAGNOSIS_TYPES の並び順で先勝ち (決定的)。
 */
export function matchType(scores: TagWeights): DiagnosisType {
  const userVec = toVector(scores)
  let best = DIAGNOSIS_TYPES[0]
  let bestSim = -1
  for (const t of DIAGNOSIS_TYPES) {
    const sim = cosine(userVec, toVector(t.weights))
    if (sim > bestSim) {
      bestSim = sim
      best = t
    }
  }
  return best
}
