// ============================================================
// うらにゃん。: キャラ (猫種・犬種) カタログ
// ============================================================
// ユーザーは「自分のニャンじろう・ポチ」を選んでパーソナライズできる。
// 絵文字 1 文字でアバター表示する (画像アセットは MVP では持たない)。
// id は永続化キー (DB の users.uranyan_cat_breed / dog_breed)。
// 増減は後方互換を保ちつつ末尾追加可能。

export interface BreedOption {
  id: string
  label: string
  emoji: string
}

export const CAT_BREEDS: readonly BreedOption[] = [
  { id: 'mike',       label: '三毛猫',           emoji: '🐱' },
  { id: 'kuro',       label: '黒猫',             emoji: '🐈‍⬛' },
  { id: 'shiro',      label: '白猫',             emoji: '🐈' },
  { id: 'kijitora',   label: 'キジトラ',         emoji: '🐯' },
  { id: 'munchkin',   label: 'マンチカン',       emoji: '🐾' },
  { id: 'scottish',   label: 'スコティッシュ',   emoji: '😺' },
  { id: 'persian',    label: 'ペルシャ',         emoji: '😼' },
  { id: 'bengal',     label: 'ベンガル',         emoji: '🐅' },
  { id: 'russian',    label: 'ロシアンブルー',   emoji: '😸' },
  { id: 'ragdoll',    label: 'ラグドール',       emoji: '😻' },
] as const

export const DOG_BREEDS: readonly BreedOption[] = [
  { id: 'shiba',      label: '柴犬',             emoji: '🐕' },
  { id: 'toy_poodle', label: 'トイプードル',     emoji: '🐩' },
  { id: 'corgi',      label: 'コーギー',         emoji: '🦴' },
  { id: 'golden',     label: 'ゴールデン',       emoji: '🐶' },
  { id: 'frenchie',   label: 'フレンチブルドッグ', emoji: '🐺' },
  { id: 'shih_tzu',   label: 'シーズー',         emoji: '🐾' },
  { id: 'chihuahua',  label: 'チワワ',           emoji: '🐕‍🦺' },
  { id: 'dachshund',  label: 'ダックスフンド',   emoji: '🌭' },
  { id: 'husky',      label: 'ハスキー',         emoji: '🐺' },
  { id: 'pomeranian', label: 'ポメラニアン',     emoji: '🦊' },
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
