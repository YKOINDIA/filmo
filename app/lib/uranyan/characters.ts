// ============================================================
// うらにゃん。: キャラ (猫種・犬種) カタログ
// ============================================================
// ユーザーは「自分のニャンじろう・ポチ」を選んでパーソナライズできる。
// 各 breed は SVG アイコン用の visual プロパティを持つ (breedIcons.tsx)。
// emoji はフォールバック (シェアテキスト/コンパクト表示) で残す。
// id は永続化キー (DB の users.uranyan_cat_breed / dog_breed)。
// 増減は後方互換を保ちつつ末尾追加可能。

// ─────────────────────────────────────────────────────────────
// 犬種 visual パラメータ
// ─────────────────────────────────────────────────────────────
export type DogEarStyle =
  | 'prick'        // 直立三角 (柴・コーギー・ハスキー・秋田)
  | 'floppy'       // 垂れ耳 (ゴールデン・ラブラドール)
  | 'big_floppy'   // 大きく垂れる (ビーグル・キャバリア)
  | 'long_floppy'  // 細長く垂れる (ダックス・シーズー)
  | 'bat'          // コウモリ耳 (フレンチブルドッグ・パグ)
  | 'curly'        // ふわふわ巻き毛 (トイプードル)
  | 'small_prick'  // 小ぶり直立 (チワワ・ポメ)
  | 'feathered'    // 飾り毛つき (パピヨン・ヨーキー)

export type DogFaceMask =
  | 'none'
  | 'snout_white'      // 鼻まわり白 (柴)
  | 'forehead_blaze'   // 額に白の縦線 (ビーグル・ボーダー)
  | 'eye_patch_left'   // 左目だけ黒パッチ (ジャックラッセル)
  | 'eye_mask'         // 目元黒マスク (パグ・フレンチ)
  | 'tuxedo'           // 顔全体二色 (ボーダーコリー)

export interface DogVisual {
  faceColor: string
  earColor?: string         // 省略時は faceColor
  earStyle: DogEarStyle
  snoutColor?: string       // 鼻先の色 (薄い色を重ねたい時)
  mask?: DogFaceMask
  maskColor?: string        // mask の塗り色
  noseColor?: string        // 鼻の色 (デフォ黒)
  eyeColor?: 'black' | 'blue' | 'amber'
  tongue?: boolean          // ピンク舌
  fluffy?: boolean          // 顔輪郭をモコモコに (ポメ・パピヨン)
}

// ─────────────────────────────────────────────────────────────
// 猫種 visual パラメータ
// ─────────────────────────────────────────────────────────────
export type CatPattern =
  | 'solid'        // 単色
  | 'tabby'        // 縞 (キジトラ・サバトラ)
  | 'tortie'       // 三毛 (パッチ)
  | 'pointed'      // ポイント (シャム)
  | 'tuxedo'       // タキシード (白×黒)

export interface CatVisual {
  faceColor: string
  earInner?: string
  pattern?: CatPattern
  patternColor?: string     // パターン色 (縞・パッチ)
  patternColor2?: string    // 三毛の追加色
  eyeColor?: string         // デフォ '#7FD171' (緑)
  noseColor?: string        // デフォ '#F4A0B5'
  fluffy?: boolean          // 顔輪郭フワフワ (ペルシャ・ラグドール)
}

// ─────────────────────────────────────────────────────────────
// BreedOption
// ─────────────────────────────────────────────────────────────
export interface BreedOption {
  id: string
  label: string
  emoji: string             // フォールバック
  dog?: DogVisual
  cat?: CatVisual
}

// ─────────────────────────────────────────────────────────────
// 犬種カタログ (20種)
// ─────────────────────────────────────────────────────────────
export const DOG_BREEDS: readonly BreedOption[] = [
  { id: 'shiba',        label: '柴犬',           emoji: '🐕', dog: {
    faceColor: '#D49658', earColor: '#B97A3B', earStyle: 'prick',
    snoutColor: '#FAF4EA', mask: 'snout_white', tongue: false,
  }},
  { id: 'kuro_shiba',   label: '黒柴',           emoji: '🐕', dog: {
    faceColor: '#2C2620', earColor: '#1A1612', earStyle: 'prick',
    snoutColor: '#E8DEC8', mask: 'snout_white',
  }},
  { id: 'shiro_shiba',  label: '白柴',           emoji: '🐕', dog: {
    faceColor: '#F5EFE0', earColor: '#E0D6BF', earStyle: 'prick',
  }},
  { id: 'akita',        label: '秋田犬',         emoji: '🐕', dog: {
    faceColor: '#E2B98A', earColor: '#C28E5A', earStyle: 'prick',
    snoutColor: '#FAF4EA', mask: 'snout_white',
  }},
  { id: 'toy_poodle',   label: 'トイプードル',   emoji: '🐩', dog: {
    faceColor: '#E6D2B0', earColor: '#D8BF93', earStyle: 'curly',
    fluffy: true,
  }},
  { id: 'black_poodle', label: '黒プードル',     emoji: '🐩', dog: {
    faceColor: '#1A1714', earColor: '#0E0B09', earStyle: 'curly',
    fluffy: true,
  }},
  { id: 'chihuahua',    label: 'チワワ',         emoji: '🐕‍🦺', dog: {
    faceColor: '#DAB48A', earColor: '#C49464', earStyle: 'small_prick',
  }},
  { id: 'dachshund',    label: 'ダックスフンド', emoji: '🌭', dog: {
    faceColor: '#9C5A2E', earColor: '#6E3A18', earStyle: 'long_floppy',
    snoutColor: '#C68752',
  }},
  { id: 'corgi',        label: 'コーギー',       emoji: '🐶', dog: {
    faceColor: '#E5B581', earColor: '#C48956', earStyle: 'prick',
    snoutColor: '#FAF4EA', mask: 'snout_white', tongue: true,
  }},
  { id: 'golden',       label: 'ゴールデン',     emoji: '🐶', dog: {
    faceColor: '#E8C788', earColor: '#D6AC65', earStyle: 'floppy',
    tongue: true,
  }},
  { id: 'labrador',     label: 'ラブラドール',   emoji: '🐶', dog: {
    faceColor: '#5A3A22', earColor: '#3F2716', earStyle: 'floppy',
    snoutColor: '#876143',
  }},
  { id: 'beagle',       label: 'ビーグル',       emoji: '🐶', dog: {
    faceColor: '#E5B581', earColor: '#7A4A28', earStyle: 'big_floppy',
    snoutColor: '#FAF4EA', mask: 'forehead_blaze', maskColor: '#FFFFFF',
  }},
  { id: 'frenchie',     label: 'フレンチブル',   emoji: '🐕', dog: {
    faceColor: '#D8C3A1', earColor: '#C2AA85', earStyle: 'bat',
    snoutColor: '#3D352B', mask: 'eye_mask', maskColor: '#3D352B',
  }},
  { id: 'pug',          label: 'パグ',           emoji: '🐕', dog: {
    faceColor: '#E0C895', earColor: '#2C2418', earStyle: 'bat',
    mask: 'eye_mask', maskColor: '#2C2418', tongue: true,
  }},
  { id: 'shih_tzu',     label: 'シーズー',       emoji: '🐩', dog: {
    faceColor: '#F0E2C4', earColor: '#C9A87A', earStyle: 'long_floppy',
    fluffy: true,
  }},
  { id: 'pomeranian',   label: 'ポメラニアン',   emoji: '🦊', dog: {
    faceColor: '#E5A45A', earColor: '#CC8538', earStyle: 'small_prick',
    snoutColor: '#FAF4EA', fluffy: true,
  }},
  { id: 'husky',        label: 'ハスキー',       emoji: '🐺', dog: {
    faceColor: '#8B8B8B', earColor: '#5C5C5C', earStyle: 'prick',
    snoutColor: '#FAFAFA', mask: 'snout_white', eyeColor: 'blue',
  }},
  { id: 'border_collie',label: 'ボーダーコリー', emoji: '🐕', dog: {
    faceColor: '#1A1612', earColor: '#0E0B09', earStyle: 'prick',
    snoutColor: '#FAFAFA', mask: 'tuxedo', maskColor: '#FAFAFA',
  }},
  { id: 'jack_russell', label: 'ジャックラッセル', emoji: '🐕', dog: {
    faceColor: '#FAF4EA', earColor: '#9C5A2E', earStyle: 'floppy',
    mask: 'eye_patch_left', maskColor: '#9C5A2E',
  }},
  { id: 'papillon',     label: 'パピヨン',       emoji: '🐕', dog: {
    faceColor: '#FAF4EA', earColor: '#9C5A2E', earStyle: 'feathered',
    fluffy: true,
  }},
] as const

// ─────────────────────────────────────────────────────────────
// 猫種カタログ (15種)
// ─────────────────────────────────────────────────────────────
export const CAT_BREEDS: readonly BreedOption[] = [
  { id: 'mike',       label: '三毛猫',         emoji: '🐱', cat: {
    faceColor: '#FAF4EA', pattern: 'tortie',
    patternColor: '#E5A45A', patternColor2: '#2C2620',
  }},
  { id: 'kuro',       label: '黒猫',           emoji: '🐈‍⬛', cat: {
    faceColor: '#1A1612', earInner: '#5C2E3A',
    eyeColor: '#F0C040',
  }},
  { id: 'shiro',      label: '白猫',           emoji: '🐈', cat: {
    faceColor: '#FAF4EA', earInner: '#F4A0B5',
    eyeColor: '#5EC8E2',
  }},
  { id: 'kijitora',   label: 'キジトラ',       emoji: '🐯', cat: {
    faceColor: '#C28A4A', pattern: 'tabby',
    patternColor: '#5C3818',
  }},
  { id: 'sabatora',   label: 'サバトラ',       emoji: '🐈', cat: {
    faceColor: '#9CA5A8', pattern: 'tabby',
    patternColor: '#4A5054',
  }},
  { id: 'chatora',    label: '茶トラ',         emoji: '🐈', cat: {
    faceColor: '#E5A45A', pattern: 'tabby',
    patternColor: '#A85A28',
  }},
  { id: 'munchkin',   label: 'マンチカン',     emoji: '🐱', cat: {
    faceColor: '#E8D5B7', pattern: 'tabby',
    patternColor: '#A88554', earInner: '#F4A0B5',
  }},
  { id: 'scottish',   label: 'スコティッシュ', emoji: '😺', cat: {
    faceColor: '#C2B8A8', earInner: '#F4A0B5',
    eyeColor: '#F0AC4A',
  }},
  { id: 'persian',    label: 'ペルシャ',       emoji: '😼', cat: {
    faceColor: '#F0E2C4', earInner: '#F4A0B5',
    eyeColor: '#F0AC4A', fluffy: true,
  }},
  { id: 'bengal',     label: 'ベンガル',       emoji: '🐅', cat: {
    faceColor: '#D49658', pattern: 'tabby',
    patternColor: '#1A1612', eyeColor: '#5EE2A8',
  }},
  { id: 'russian',    label: 'ロシアンブルー', emoji: '😸', cat: {
    faceColor: '#7A8A95', earInner: '#A4B0B8',
    eyeColor: '#5EE2A8',
  }},
  { id: 'ragdoll',    label: 'ラグドール',     emoji: '😻', cat: {
    faceColor: '#FAF0E0', pattern: 'pointed',
    patternColor: '#8B6F4E', eyeColor: '#5EC8E2', fluffy: true,
  }},
  { id: 'siamese',    label: 'シャム',         emoji: '😻', cat: {
    faceColor: '#F0E2C4', pattern: 'pointed',
    patternColor: '#3A2A1A', eyeColor: '#5EC8E2',
  }},
  { id: 'tuxedo',     label: 'はちわれ',       emoji: '🐱', cat: {
    faceColor: '#1A1612', pattern: 'tuxedo',
    patternColor: '#FAF4EA',
  }},
  { id: 'norwegian',  label: 'ノルウェージャン', emoji: '🐱', cat: {
    faceColor: '#A88554', pattern: 'tabby',
    patternColor: '#5C3818', eyeColor: '#5EE2A8', fluffy: true,
  }},
] as const

export const DEFAULT_CAT_BREED = 'mike'
export const DEFAULT_DOG_BREED = 'shiba'

export function getCatBreed(id: string | null | undefined): BreedOption {
  if (!id) return CAT_BREEDS.find(b => b.id === DEFAULT_CAT_BREED)!
  return CAT_BREEDS.find(b => b.id === id) ?? CAT_BREEDS.find(b => b.id === DEFAULT_CAT_BREED)!
}

export function getDogBreed(id: string | null | undefined): BreedOption {
  if (!id) return DOG_BREEDS.find(b => b.id === DEFAULT_DOG_BREED)!
  return DOG_BREEDS.find(b => b.id === id) ?? DOG_BREEDS.find(b => b.id === DEFAULT_DOG_BREED)!
}

// ============================================================
// 関係性ラベル (uranyan_targets.relationship)
// ============================================================
export type Relationship = 'self' | 'friend' | 'family' | 'crush' | 'partner' | 'idol' | 'other'

export const RELATIONSHIP_LABELS: Record<Relationship, { label: string; emoji: string }> = {
  self:    { label: '自分',     emoji: '🪞' },
  friend:  { label: '友達',     emoji: '🤝' },
  family:  { label: '家族',     emoji: '🏠' },
  crush:   { label: '気になる人', emoji: '💘' },
  partner: { label: '恋人',     emoji: '💞' },
  idol:    { label: '推し',     emoji: '⭐' },
  other:   { label: 'その他',   emoji: '✨' },
}

export const RELATIONSHIPS: readonly Relationship[] =
  ['self','friend','family','crush','partner','idol','other'] as const
