// ============================================================
// 宿曜占星術: 27宿の算出
// ============================================================
// 生年月日 (JST) から月の真黄経 → 恒星黄経 (Lahiri ayanamsa) → 27宿。
//
// 月の真黄経は Meeus "Astronomical Algorithms" の周期項主要 6 項を採用。
// 平均黄経からの誤差は通常 ±0.5° に収まり、宿境界 (13°20') に対し
// 十分に余裕がある。
//
// 27宿の並びは 昴宿 を起点とする日本宿曜伝統に従う。
// (恒星座標で昴 = Krittika 起点 = 26°40' 恒星黄経)
//
// 生時不明のため JST 0:00 (= UTC 15:00 前日) を採用する。
// 同じ日でも生時で前後の宿に変わり得るが、暦上の「その日の宿」を採る。

export type Mansion =
  | '昴' | '畢' | '觜' | '参' | '井' | '鬼' | '柳' | '星' | '張'
  | '翼' | '軫' | '角' | '亢' | '氐' | '房' | '心' | '尾' | '箕'
  | '斗' | '女' | '虚' | '危' | '室' | '壁' | '奎' | '婁' | '胃'

export const MANSIONS: readonly Mansion[] = [
  '昴','畢','觜','参','井','鬼','柳','星','張',
  '翼','軫','角','亢','氐','房','心','尾','箕',
  '斗','女','虚','危','室','壁','奎','婁','胃',
] as const

// ─────────────────────────────────────────────────────────────
// JD (ユリウス日) 算出: JST 0:00 を基準
// ─────────────────────────────────────────────────────────────
function julianDayJST(year: number, month: number, day: number): number {
  // Date.UTC(y,m-1,d) は UTC 0:00 の ms。
  // JST 0:00 = UTC 15:00 (前日) なので -9h シフトする。
  const ms = Date.UTC(year, month - 1, day) - 9 * 3600 * 1000
  // ms (Unix epoch) → JD: JD = ms/86400000 + 2440587.5
  return ms / 86_400_000 + 2440587.5
}

// ─────────────────────────────────────────────────────────────
// 月の真黄経 (degrees)
// ─────────────────────────────────────────────────────────────
function rad(deg: number): number { return deg * Math.PI / 180 }
function norm360(deg: number): number {
  const r = deg % 360
  return r < 0 ? r + 360 : r
}

function moonTrueLongitude(jd: number): number {
  // J2000 (2000-01-01 12:00 TT) からのユリウス世紀
  const T = (jd - 2451545.0) / 36525

  // 平均要素 (Meeus 47.1〜47.4 を簡略化)
  const L  = norm360(218.3164477 + 481267.88123421 * T) // 平均黄経
  const D  = norm360(297.8501921 + 445267.1114034  * T) // 平均離角 (月-太陽)
  const Ms = norm360(357.5291092 +  35999.0502909  * T) // 太陽平均近点角
  const Mm = norm360(134.9633964 + 477198.8675055  * T) // 月平均近点角
  const F  = norm360( 93.2720950 + 483202.0175233  * T) // 黄緯引数

  // 周期項 (黄経補正・度) — 上位 6 項のみ
  //   係数は Meeus Table 47.A から (deg 単位)
  let dL = 0
  dL += 6.288774 * Math.sin(rad(Mm))
  dL += 1.274027 * Math.sin(rad(2*D - Mm))
  dL += 0.658314 * Math.sin(rad(2*D))
  dL += 0.213618 * Math.sin(rad(2*Mm))
  dL += -0.185116 * Math.sin(rad(Ms))
  dL += -0.114332 * Math.sin(rad(2*F))

  return norm360(L + dL)
}

// ─────────────────────────────────────────────────────────────
// アヤナムシャ (Lahiri) — 黄道座標 → 恒星座標 補正
// ─────────────────────────────────────────────────────────────
// 春分点が歳差で移動するぶんを差し引くと恒星座標になる。
// Lahiri ayanamsa: 約 23.85° (J2000) + 約 50.3"/年 ≈ 0.01397°/年。
function ayanamsa(jd: number): number {
  const T = (jd - 2451545.0) / 36525
  return 23.8504 + 1.396 * T // 1.396°/century ≈ 50.3"/year
}

// ─────────────────────────────────────────────────────────────
// 公開: 生年月日 → 27宿
// ─────────────────────────────────────────────────────────────
export function mansionOf(year: number, month: number, day: number): Mansion {
  const jd = julianDayJST(year, month, day) + 0.5 // JST 12:00 を採用 (日中央の月位置)
  const tropical = moonTrueLongitude(jd)
  const sidereal = norm360(tropical - ayanamsa(jd))
  // 昴宿の起点は恒星黄経 26°40' = 26.6667°
  const idx = Math.floor(((sidereal - 26.6667 + 360) % 360) / (360 / 27))
  return MANSIONS[((idx % 27) + 27) % 27]
}

export function mansionIndex(m: Mansion): number {
  return MANSIONS.indexOf(m)
}

// ─────────────────────────────────────────────────────────────
// テスト用エクスポート
// ─────────────────────────────────────────────────────────────
export const __test = { julianDayJST, moonTrueLongitude, ayanamsa }
