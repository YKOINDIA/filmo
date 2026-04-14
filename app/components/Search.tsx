'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import WorkRegisterModal from './WorkRegisterModal'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

type TabKey = 'movie' | 'drama' | 'anime'

interface TMDBItem {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  media_type?: string
  release_date?: string
  first_air_date?: string
  vote_average: number
  overview: string
  genre_ids: number[]
}

interface SectionData {
  title: string
  items: TMDBItem[]
  loading: boolean
}

interface BrowseState {
  mode: 'home' | 'genre' | 'year' | 'provider' | 'award' | 'country' | 'company'
  label: string
  items: TMDBItem[]
  loading: boolean
  page: number
  totalPages: number
}

const MOVIE_GENRES = [
  { id: 28, name: 'アクション', emoji: '💥' },
  { id: 12, name: 'アドベンチャー', emoji: '🗺️' },
  { id: 35, name: 'コメディ', emoji: '😂' },
  { id: 80, name: '犯罪', emoji: '🔫' },
  { id: 99, name: 'ドキュメンタリー', emoji: '📹' },
  { id: 18, name: 'ドラマ', emoji: '🎭' },
  { id: 10751, name: 'ファミリー', emoji: '👨‍👩‍👧' },
  { id: 14, name: 'ファンタジー', emoji: '🧙' },
  { id: 36, name: '歴史', emoji: '📜' },
  { id: 27, name: 'ホラー', emoji: '👻' },
  { id: 10402, name: '音楽', emoji: '🎵' },
  { id: 9648, name: 'ミステリー', emoji: '🔍' },
  { id: 10749, name: 'ロマンス', emoji: '💕' },
  { id: 878, name: 'SF', emoji: '🚀' },
  { id: 53, name: 'スリラー', emoji: '😱' },
  { id: 10752, name: '戦争', emoji: '⚔️' },
  { id: 37, name: '西部劇', emoji: '🤠' },
]

const TV_GENRES = [
  { id: 10759, name: 'アクション＆アドベンチャー', emoji: '💥' },
  { id: 35, name: 'コメディ', emoji: '😂' },
  { id: 80, name: '犯罪', emoji: '🔫' },
  { id: 99, name: 'ドキュメンタリー', emoji: '📹' },
  { id: 18, name: 'ドラマ', emoji: '🎭' },
  { id: 10751, name: 'ファミリー', emoji: '👨‍👩‍👧' },
  { id: 9648, name: 'ミステリー', emoji: '🔍' },
  { id: 10749, name: 'ロマンス', emoji: '💕' },
  { id: 10765, name: 'SF＆ファンタジー', emoji: '🚀' },
  { id: 10768, name: '戦争＆政治', emoji: '⚔️' },
]

const ANIME_GENRES = [
  { id: 10759, name: 'アクション', emoji: '💥' },
  { id: 35, name: 'コメディ', emoji: '😂' },
  { id: 18, name: 'ドラマ', emoji: '🎭' },
  { id: 10765, name: 'SF＆ファンタジー', emoji: '🚀' },
  { id: 10749, name: 'ロマンス', emoji: '💕' },
  { id: 9648, name: 'ミステリー', emoji: '🔍' },
]

const DECADES = [
  { label: '2020年代', start: 2020, end: 2028 },
  { label: '2010年代', start: 2010, end: 2019 },
  { label: '2000年代', start: 2000, end: 2009 },
  { label: '1990年代', start: 1990, end: 1999 },
  { label: '1980年代', start: 1980, end: 1989 },
  { label: '1970年代', start: 1970, end: 1979 },
  { label: '1960年代', start: 1960, end: 1969 },
  { label: '1950年代', start: 1950, end: 1959 },
]

const PROVIDERS = [
  { id: 9, name: 'Prime Video', emoji: '📦', desc: 'Amazonの動画配信' },
  { id: 84, name: 'U-NEXT', emoji: '🟣', desc: '31日間無料トライアル' },
  { id: 1860, name: 'DMM TV', emoji: '🎬', desc: 'アニメ・エンタメ充実' },
  { id: 337, name: 'ディズニープラス', emoji: '🏰', desc: 'ディズニー・マーベル・SW' },
  { id: 1796, name: 'FOD', emoji: '📺', desc: 'フジテレビ公式' },
  { id: 85, name: 'TELASA', emoji: '🔵', desc: 'テレビ朝日公式' },
  { id: 2136, name: 'Lemino', emoji: '🟡', desc: 'NTTドコモ運営' },
  { id: 0, name: 'ABEMA', emoji: '🟠', desc: '無料で楽しめるTV' },
  { id: 15, name: 'Hulu', emoji: '🟢', desc: '日テレ系充実' },
  { id: 8, name: 'Netflix', emoji: '🔴', desc: '世界最大級の配信' },
  { id: 0, name: 'WOWOWオンデマンド', emoji: '📡', desc: '映画・ドラマ・スポーツ' },
  { id: 0, name: 'アニメタイムズ', emoji: '🎌', desc: 'アニメ専門チャンネル' },
  { id: 0, name: 'Roadstead', emoji: '🚢', desc: 'ミニシアター系作品' },
  { id: 0, name: 'J:COM STREAM', emoji: '📶', desc: 'J:COM加入者向け' },
  { id: 0, name: 'TSUTAYA DISCAS', emoji: '💿', desc: 'DVD/BD宅配レンタル' },
  { id: 283, name: 'dアニメストア', emoji: '🅰️', desc: 'アニメ見放題No.1' },
  { id: 0, name: 'Apple TV+', emoji: '🍎', desc: 'Appleオリジナル作品' },
  { id: 0, name: 'Rakuten TV', emoji: '🛒', desc: '楽天の動画配信' },
]

interface Award {
  name: string
  emoji: string
  sort: string
  voteMin: string
  voteMax?: string
  voteAvgMin?: string
  country?: string
}

const AWARDS: Award[] = [
  // 主要映画賞 (Filmarks完全対応 + α)
  { name: 'アカデミー賞', emoji: '🏆', sort: 'vote_average.desc', voteMin: '5000' },
  { name: 'ゴールデングローブ賞', emoji: '🌐', sort: 'vote_average.desc', voteMin: '3000' },
  { name: '日本アカデミー賞', emoji: '🇯🇵', sort: 'vote_average.desc', voteMin: '500', country: 'JP' },
  { name: '東京国際映画祭', emoji: '🗼', sort: 'vote_average.desc', voteMin: '200', country: 'JP' },
  { name: 'カンヌ国際映画祭', emoji: '🌴', sort: 'vote_average.desc', voteMin: '1000' },
  { name: 'ヴェネチア国際映画祭', emoji: '🦁', sort: 'vote_average.desc', voteMin: '800' },
  { name: 'ベルリン国際映画祭', emoji: '🐻', sort: 'vote_average.desc', voteMin: '800' },
  { name: 'サンダンス映画祭', emoji: '🎿', sort: 'vote_average.desc', voteMin: '500' },
  { name: 'ロサンゼルス映画批評家協会賞', emoji: '🎬', sort: 'vote_average.desc', voteMin: '2000' },
  { name: 'インディペンデント・スピリット賞', emoji: '🕊️', sort: 'vote_average.desc', voteMin: '800' },
  { name: '英国アカデミー賞', emoji: '🇬🇧', sort: 'vote_average.desc', voteMin: '2000', country: 'GB' },
  { name: 'ブルーリボン賞', emoji: '🎀', sort: 'vote_average.desc', voteMin: '300', country: 'JP' },
  { name: 'ニューヨーク映画批評家協会賞', emoji: '🗽', sort: 'vote_average.desc', voteMin: '2000' },
  { name: 'セザール賞', emoji: '🇫🇷', sort: 'vote_average.desc', voteMin: '500', country: 'FR' },
  { name: 'ゴールデンラズベリー賞', emoji: '🍓', sort: 'vote_count.desc', voteMin: '3000' },
  { name: 'モントリオール世界映画祭', emoji: '🍁', sort: 'vote_average.desc', voteMin: '300', country: 'CA' },
  { name: 'ナショナル・ボード・オブ・レビュー', emoji: '📋', sort: 'vote_average.desc', voteMin: '2000' },
  { name: 'アニー賞', emoji: '✏️', sort: 'vote_average.desc', voteMin: '500' },
  { name: 'オースティン映画批評家協会賞', emoji: '🤠', sort: 'vote_average.desc', voteMin: '1000' },
  { name: 'TAMA映画賞', emoji: '🎌', sort: 'vote_average.desc', voteMin: '100', country: 'JP' },
  { name: 'キネコ国際映画祭', emoji: '🧒', sort: 'vote_average.desc', voteMin: '50', country: 'JP' },
  { name: '放送映画批評家協会賞', emoji: '📺', sort: 'vote_average.desc', voteMin: '2000' },
  { name: 'ヨーロッパ映画賞', emoji: '🇪🇺', sort: 'vote_average.desc', voteMin: '500' },
  { name: 'MTVムービー・アワード', emoji: '📻', sort: 'popularity.desc', voteMin: '3000' },
  { name: 'トロント国際映画祭', emoji: '🇨🇦', sort: 'vote_average.desc', voteMin: '500' },
  { name: 'アジア映画大賞', emoji: '🌏', sort: 'vote_average.desc', voteMin: '200' },
  { name: 'ストックホルム国際映画祭', emoji: '🇸🇪', sort: 'vote_average.desc', voteMin: '200', country: 'SE' },
  { name: 'カルロヴィ・ヴァリ国際映画祭', emoji: '🇨🇿', sort: 'vote_average.desc', voteMin: '200', country: 'CZ' },
  // Filmo独自
  { name: '高評価映画 (8.0+)', emoji: '⭐', sort: 'vote_average.desc', voteMin: '1000', voteAvgMin: '8' },
  { name: '隠れた名作', emoji: '💎', sort: 'vote_average.desc', voteMin: '100', voteMax: '1000', voteAvgMin: '7.5' },
  { name: 'カルト映画', emoji: '🔮', sort: 'vote_count.desc', voteMin: '200', voteMax: '2000', voteAvgMin: '7' },
  { name: '興行収入トップ', emoji: '💰', sort: 'revenue.desc', voteMin: '1000' },
]

// Full 180+ countries/regions (Filmarks 176 + extras)
const COUNTRIES: { code: string; name: string }[] = [
  // 主要国 (上部に表示)
  { code: 'JP', name: '日本' },{ code: 'US', name: 'アメリカ' },{ code: 'GB', name: 'イギリス' },
  { code: 'FR', name: 'フランス' },{ code: 'KR', name: '韓国' },{ code: 'CN', name: '中国' },
  { code: 'IN', name: 'インド' },{ code: 'IT', name: 'イタリア' },{ code: 'DE', name: 'ドイツ' },
  { code: 'ES', name: 'スペイン' },{ code: 'HK', name: '香港' },{ code: 'TW', name: '台湾' },
  { code: 'CA', name: 'カナダ' },{ code: 'AU', name: 'オーストラリア' },{ code: 'BR', name: 'ブラジル' },
  { code: 'RU', name: 'ロシア' },{ code: 'TH', name: 'タイ' },{ code: 'SE', name: 'スウェーデン' },
  { code: 'MX', name: 'メキシコ' },{ code: 'DK', name: 'デンマーク' },
  // あ行
  { code: 'IS', name: 'アイスランド' },{ code: 'IE', name: 'アイルランド' },
  { code: 'AZ', name: 'アゼルバイジャン' },{ code: 'AF', name: 'アフガニスタン' },
  { code: 'AS', name: 'アメリカ領サモア' },{ code: 'AE', name: 'アラブ首長国連邦' },
  { code: 'DZ', name: 'アルジェリア' },{ code: 'AR', name: 'アルゼンチン' },
  { code: 'AL', name: 'アルバニア' },{ code: 'AM', name: 'アルメニア' },
  { code: 'AO', name: 'アンゴラ' },{ code: 'AD', name: 'アンドラ' },
  { code: 'YE', name: 'イエメン' },{ code: 'VG', name: 'イギリス領ヴァージン諸島' },
  { code: 'IL', name: 'イスラエル' },{ code: 'IQ', name: 'イラク' },{ code: 'IR', name: 'イラン' },
  { code: 'ID', name: 'インドネシア' },{ code: 'UG', name: 'ウガンダ' },
  { code: 'UA', name: 'ウクライナ' },{ code: 'UZ', name: 'ウズベキスタン' },
  { code: 'UY', name: 'ウルグアイ' },{ code: 'EC', name: 'エクアドル' },
  { code: 'EG', name: 'エジプト' },{ code: 'EE', name: 'エストニア' },
  { code: 'ET', name: 'エチオピア' },{ code: 'SV', name: 'エルサルバドル' },
  { code: 'OM', name: 'オマーン' },{ code: 'NL', name: 'オランダ' },
  { code: 'AN', name: 'オランダ領アンティル' },{ code: 'AT', name: 'オーストリア' },
  // か行
  { code: 'KZ', name: 'カザフスタン' },{ code: 'QA', name: 'カタール' },
  { code: 'CM', name: 'カメルーン' },{ code: 'KH', name: 'カンボジア' },
  { code: 'CV', name: 'カーボベルデ共和国' },{ code: 'GY', name: 'ガイアナ' },
  { code: 'GA', name: 'ガボン' },{ code: 'GH', name: 'ガーナ' },
  { code: 'CY', name: 'キプロス' },{ code: 'CU', name: 'キューバ' },
  { code: 'KG', name: 'キルギス' },{ code: 'GN', name: 'ギニア' },
  { code: 'GW', name: 'ギニアビサウ共和国' },{ code: 'GR', name: 'ギリシャ' },
  { code: 'KW', name: 'クウェート' },{ code: 'HR', name: 'クロアチア' },
  { code: 'GT', name: 'グアテマラ' },{ code: 'GU', name: 'グアム' },
  { code: 'GL', name: 'グリーンランド' },{ code: 'KY', name: 'ケイマン諸島' },
  { code: 'KE', name: 'ケニア' },{ code: 'CR', name: 'コスタリカ' },
  { code: 'XK', name: 'コソボ' },{ code: 'CO', name: 'コロンビア' },
  { code: 'CG', name: 'コンゴ' },{ code: 'CI', name: 'コートジボワール' },
  // さ行
  { code: 'SA', name: 'サウジアラビア' },{ code: 'ZM', name: 'ザンビア' },
  { code: 'SY', name: 'シリア' },{ code: 'SG', name: 'シンガポール' },
  { code: 'JM', name: 'ジャマイカ' },{ code: 'GE', name: 'ジョージア' },
  { code: 'ZW', name: 'ジンバブエ' },{ code: 'CH', name: 'スイス' },
  { code: 'LK', name: 'スリランカ' },{ code: 'SK', name: 'スロバキア' },
  { code: 'SI', name: 'スロベニア' },{ code: 'SD', name: 'スーダン' },
  { code: 'SN', name: 'セネガル' },{ code: 'RS', name: 'セルビア' },
  { code: 'CS', name: 'セルビア・モンテネグロ' },{ code: 'KN', name: 'セントクリストファー・ネービス' },
  { code: 'SO', name: 'ソマリア' },{ code: 'SB', name: 'ソロモン諸島' },
  { code: 'SU', name: 'ソ連' },
  // た行
  { code: 'TJ', name: 'タジキスタン' },{ code: 'TZ', name: 'タンザニア' },
  { code: 'CZ', name: 'チェコ' },{ code: 'CSHH', name: 'チェコスロバキア' },
  { code: 'TD', name: 'チャド' },{ code: 'TN', name: 'チュニジア' },
  { code: 'CL', name: 'チリ' },{ code: 'TT', name: 'トリニダード・トバゴ' },
  { code: 'TM', name: 'トルクメニスタン' },{ code: 'TR', name: 'トルコ' },
  { code: 'DO', name: 'ドミニカ共和国' },
  // な行
  { code: 'NG', name: 'ナイジェリア' },{ code: 'NA', name: 'ナミビア' },
  { code: 'NI', name: 'ニカラグア' },{ code: 'NE', name: 'ニジェール' },
  { code: 'NZ', name: 'ニュージーランド' },{ code: 'NP', name: 'ネパール' },
  { code: 'NO', name: 'ノルウェー' },
  // は行
  { code: 'HT', name: 'ハイチ' },{ code: 'HU', name: 'ハンガリー' },
  { code: 'VU', name: 'バヌアツ' },{ code: 'BS', name: 'バハマ' },
  { code: 'BB', name: 'バルバドス' },{ code: 'BD', name: 'バングラデシュ' },
  { code: 'BH', name: 'バーレーン' },{ code: 'PK', name: 'パキスタン' },
  { code: 'PA', name: 'パナマ' },{ code: 'PG', name: 'パプアニューギニア' },
  { code: 'PY', name: 'パラグアイ' },{ code: 'PS', name: 'パレスチナ' },
  { code: 'FJ', name: 'フィジー' },{ code: 'PH', name: 'フィリピン' },
  { code: 'FI', name: 'フィンランド' },{ code: 'PF', name: 'フランス領ポリネシア' },
  { code: 'BG', name: 'ブルガリア' },{ code: 'BF', name: 'ブルキナファソ' },
  { code: 'BN', name: 'ブルネイ' },{ code: 'BT', name: 'ブータン' },
  { code: 'PR', name: 'プエルトリコ' },{ code: 'VN', name: 'ベトナム' },
  { code: 'BJ', name: 'ベナン' },{ code: 'VE', name: 'ベネズエラ' },
  { code: 'BY', name: 'ベラルーシ' },{ code: 'BZ', name: 'ベリーズ' },
  { code: 'BE', name: 'ベルギー' },{ code: 'PE', name: 'ペルー' },
  { code: 'HN', name: 'ホンジュラス' },{ code: 'BA', name: 'ボスニア・ヘルツェゴビナ' },
  { code: 'BW', name: 'ボツワナ' },{ code: 'BO', name: 'ボリビア' },
  { code: 'PT', name: 'ポルトガル' },{ code: 'PL', name: 'ポーランド' },
  // ま行
  { code: 'MO', name: 'マカオ' },{ code: 'MK', name: 'マケドニア' },
  { code: 'MG', name: 'マダガスカル' },{ code: 'ML', name: 'マリ' },
  { code: 'MT', name: 'マルタ共和国' },{ code: 'MY', name: 'マレーシア' },
  { code: 'MH', name: 'マーシャル諸島' },{ code: 'FM', name: 'ミクロネシア' },
  { code: 'MM', name: 'ミャンマー' },{ code: 'MZ', name: 'モザンビーク' },
  { code: 'MC', name: 'モナコ' },{ code: 'MV', name: 'モルディブ' },
  { code: 'MD', name: 'モルドバ' },{ code: 'MA', name: 'モロッコ' },
  { code: 'MN', name: 'モンゴル' },{ code: 'ME', name: 'モンテネグロ' },
  { code: 'MU', name: 'モーリシャス共和国' },{ code: 'MR', name: 'モーリタニア' },
  // や行
  { code: 'YUCS', name: 'ユーゴスラビア' },{ code: 'JO', name: 'ヨルダン' },
  // ら行
  { code: 'LA', name: 'ラオス' },{ code: 'LV', name: 'ラトビア' },
  { code: 'LT', name: 'リトアニア' },{ code: 'LI', name: 'リヒテンシュタイン' },
  { code: 'LY', name: 'リビア' },{ code: 'LR', name: 'リベリア' },
  { code: 'LU', name: 'ルクセンブルク' },{ code: 'RW', name: 'ルワンダ' },
  { code: 'RO', name: 'ルーマニア' },{ code: 'LS', name: 'レソト' },
  { code: 'LB', name: 'レバノン' },
  // 漢字
  { code: 'KP', name: '北朝鮮' },{ code: 'ZA', name: '南アフリカ' },
  { code: 'TL', name: '東ティモール' },{ code: 'DDDE', name: '東ドイツ' },
  { code: 'DEDE', name: '西ドイツ' },{ code: 'GQ', name: '赤道ギニア' },
]

// Known TMDB company IDs for major distributors (used for direct lookup)
const COMPANY_ID_MAP: Record<string, number> = {
  'ウォルト・ディズニー・ジャパン': 2, 'ウォルト・ディズニー・スタジオ・ジャパン': 2,
  'ユニバーサル映画': 33, 'ユニヴァーサル': 33,
  'ワーナー・ブラザース映画': 174, 'ワーナー': 174,
  'パラマウント・ピクチャーズ': 4, '20世紀フォックス映画': 25,
  'コロンビア映画': 5, 'コロンビア': 5, 'コロムビア映画': 5,
  'ソニー・ピクチャーズ': 34, 'ソニー・ピクチャーズ エンタテインメント': 34,
  '東宝': 7505, '東宝東和': 7505, '東映': 5542, '東映アニメーション': 5765,
  '松竹': 1507, 'KADOKAWA': 2251, '角川映画': 2251,
  'スタジオジブリ': 882, 'A24': 41077,
  'MGM': 21, 'NBCユニバーサル・エンターテイメント': 33,
  'アニプレックス': 13113, 'コミックス・ウェーブ・フィルム': 49898,
  '東京テアトル': 5765, '日活': 5765, 'キノフィルムズ': 130137,
  'ギャガ': 6583, 'アスミック・エース': 5765, 'トランスフォーマー': 174,
  'スタジオ地図': 115003, 'MAPPA': 109153, 'ufotable': 26218,
}

// Full distributor list from Filmarks (grouped by あいうえお order)
const DISTRIBUTORS: { heading: string; names: string[] }[] = [
  { heading: '英数', names: ['Go×En','WAW','weber CINEMA CLUB','AMGエンタテインメント','ABCリブラ','ATG','CIC','CKエンタテインメント','CJ Entertainment Japan','DCT entertainment','D-films','Engawa Films Project','ENBUゼミナール','Elles Films','Foggy','FIKAFILM','Filmarks','Filmssimo','FLICKK','FLYING IMAGE','GACHINKO Film','GBGG Production','GOLD FISH FILMS LIVEUP','GUM','IAC MUSIC JAPAN','IMAGICA TV','J SPORTS','JAIHO','JAYMEN TOKYO','JET','JIGGYFILMS','JOYUP','K2エンタテインメント','K2Pictures','K3企画','KDDI','KODARU','KOBY PICTURES','KOOKS FILM','KT StudioGenie','KYO＋','Lamp.','MGM','Mirovision','MMJ','MomentumLabo.','MUGENUP inc.','NEGA','Netflix','NOROSHI','NSW','OCAWARI','OHGURO FILM','OTAK映画社','Otter pictures','Open Culture Entertainment','Planetafilm','RAW FILM','REALCOFFEE ENTERTAINMENT','REGENTS','REWINDERA PICTURES','RKO日本支社','RKOラジオ日本支社','Route9 & Friends','SAIGATE','SAMANSA','Santa Barbara Pictures','SASSO CO., LTD.','SCRAMBLE FILM','Sending You','Shkran','SHM FILMS','SPACE SHOWER FILMS','SPOTTED PRODUCTIONS','STAR CHANNEL MOVIES','Stranger','STREET LABO','SUNDAE','SUPER BENTO ENTERTEINMENT','S・D・P','Spanic Films','Soul Boat','CHIMNEY TOWN','CHOCOLATE Inc.','CHIPANGU','COMTEG','TRYSOME BROS.','TRYDENT PICTURES','TWENTY FIRST CITY','Team 結婚の報告','TeamDylan','TK事業開発研究所','TCエンタテインメント','TBSテレビ','T-artist','10ANTS','Tokyo New Cinema','TOHO NEXT','TSUBOFILM','UIP','UNCOLORED','VANDALISM','VOICE OF GHOST','WOWOW','WOWOWプラス','YOAKE FILM','Yo-Pro'] },
  { heading: 'あ', names: ['アイエス・フィールド','アイ・エム・ティ','アイ・ヴィー・シー','アウトサイド','青空映画舎','アカリノ映画舎','アギィ','アクセスエー','アジョンス・ドゥ・原生林','アステア','アスミック','アスミック＝パルコ','アスミック・エース','アスランフィルム','アダンソニア','アットエンタテインメント','アップリンク','Atemo','アニプレックス','アニメック','アニモプロデュース','After School Cinema Club','アミューズ・ピクチャーズ','アムモ98','彩プロ','アルゴプロジェクト','アルバトロス・フィルム','ALFAZBET','アルファヴィル','アルミード','and pictures','アンプラグド','アークエンタテインメント','Arct\'4 Film','アーク・フィルムズ','アース・スターエンターテイメント','アースライズ','アートポート','アート・アンサンブル'] },
  { heading: 'い', names: ['イオンエンターテイメント','ikoi films','いせフィルム','inasato','イナズマ社','イハフィルムズ','Incline','インターフィルム','インドエイガジャパン','impasse','インプレオ','Eastworld Entertainment','イーチタイム','イーニッド・フィルム'] },
  { heading: 'う', names: ['ウィルコ','ウォルト・ディズニー・ジャパン','ウォルト・ディズニー・スタジオ・ジャパン','太秦','ウッディ'] },
  { heading: 'え', names: ['エアプレーンレーベル','映画『杳かなる』上映委員会','映像制作リアン','エイベックス・エンタテインメント','エイベックス・ピクチャーズ','エイベックス・フィルムレーベルズ','エクストリーム','エスパース・サロウ','エスピーオー','エタンチェ','EternalWind Factory','エデン','NBCユニバーサル・エンターテイメント','エネサイ','えびふらいレコーズ','emir heart Inc.','エムエフピクチャーズ','エレファントハウス','エレファント・ピクチャー','エンジンフイルム'] },
  { heading: 'お', names: ['オソレゾーン','オデッサ・エンタテインメント','オフィス北野','オフィス熊谷','オフィス・インベーダー','オムロ','オムロピクチャーズ','おもしろ制作','オライオン＝ワーナー','オリオフィルムズ','オンリー・ハーツ','オープンセサミ'] },
  { heading: 'か', names: ['海燕社','海獣シアター','カエルカフェ','カズモ','活弁シネマ倶楽部','KADOKAWA','KADOKAWA Kプラス','角川ANIMATION','角川映画','角川エンタテインメント','角川ヘラルド映画','カブ研究会','株式会社 STUDIO CARNET','株式会社E.x.N','株式会社BIG RIVER FILMS','株式会社ムービック','株式会社 BBB','株式会社2L','株式会社オフィス桐生','株式会社CANTEEN','株式会社サイ','株式会社セイタロウデザインエンタテイメント','株式会社sommelierTV','株式会社ヴィレッヂ','株式会社桃','株式会社riverstone','鎌田フィルム','カラー','カルチャヴィル合同会社','カルチャヴィル','カルチャ・パブリッシャーズ','カルチュアルライフ','川崎市アートセンター','関西テレビ放送'] },
  { heading: 'が', names: ['ガスコイン・エイシア','ガムシャラ倶楽部'] },
  { heading: 'き', names: ['キグー','KICCORIT','kine A house','キネマ旬報企画','キノコヤ映画','キノパトス','キノフィルムズ','kinologue','キャンター','京都映画センター','京都シネマ','記録活映社','きろくびと','キングレコード','kys STUDIO TOKYO','KeyHolder Pictures'] },
  { heading: 'ぎ', names: ['ギグリーボックス','ギャガ','ギャガ・コミュニケーションズ','ギャガ・コミュニケーションズ＝ヒューマックス・ピクチャーズ','ギャガ・ヒューマックス','ギャガ・プラス','ギークピクチュアズ'] },
  { heading: 'く', names: ['クイーンズカンパニー','KUZUIエンタープライズ','空族','KUDO COMPANY','熊本やまが映画プロジェクト','クレストインターナショナル','クレプスキュール フィルム','クロックワークス'] },
  { heading: 'ぐ', names: ['グッチーズ・フリースクール','グラスゴー15','グランピクス','グループ現代'] },
  { heading: 'こ', names: ['小池博史ブリッジプロジェクト-Odyssey','コギトワークス','コピアポア・フィルム','コミックス・ウェーブ・フィルム','コムストック','コムストック・グループ','コムデシネマ・ジャポン','コロムビア映画','コロンビア','コロンビア映画＝コロンビア　トライスター映画','コロンビア・トライスター','コロンビア　トライスター映画','コンテンツセブン'] },
  { heading: 'ご', names: ['合同会社adg-ethics','合同会社K-zone.','合同会社ゼリコ・フィルム','合同会社ななし','合同会社リガード／Regard'] },
  { heading: 'さ', names: ['サキプロ','サニーフィルム','サムワンズガーデン','さらい','サロンジャパン','サンタバーバラ・ピクチャーズ','サンリスフィルム'] },
  { heading: 'ざ', names: ['ザジフィルムズ','ザナドゥー'] },
  { heading: 'し', names: ['シグロ','シナジー','シネカノン','シネスコ','シネセゾン','cinepos','Cinemago','シネマスコーレ','シネマトリックス','Cinema Drifters','シネメディア','シノニム','渋谷プロダクション','シャイカー','小学館集英社プロダクション','ショウゲート','松竹','松竹ODS事業室／イノベーション推進部','松竹ODS事業室','松竹＝松竹富士','松竹富士','松竹富士＝KUZUIエンタープライズ','松竹富士＝日本ヘラルド映画','松竹ブロードキャスティング','松竹メディア事業部','湘南遊映坐','シンエイ動画','信越放送','シンカ','shinshin','新日本映画社'] },
  { heading: 'じ', names: ['ジェイ・ストーム','ジョーカーフィルムズ','神宮前プロデュース','G-STAR.PRO','ジーンハート株式会社'] },
  { heading: 'す', names: ['鈴正','スタイルジャム','スタジオジブリ','studio solars','スタジオ地図','スタジオ地図LLP','Studio-D JAPAN','スタジオねこ','スタジオレヴォ','スタンダードフィルム','スターキャット','スターキャットアルバトロス・フィルム','スターサンズ','スティングレイ','ストロール','ストームピクチャーズ','ストームレーベルズ','SPOON','SPACEBOX','スモモ','スリーピン','スールキートス'] },
  { heading: 'せ', names: ['生活の医療社','セテラ・インターナショナル','セブンフィルム','セントラルゲーム'] },
  { heading: 'ぜ', names: ['ゼアリズエンタープライズ','是空','ゼリコ・フィルム','零合舎'] },
  { heading: 'そ', names: ['ソイチウム','ソニー・ピクチャーズ','ソニー・ピクチャーズ エンタテインメント','ソニー・ミュージック エンタテインメント','sommelierTV','SORA','空架 soraca film'] },
  { heading: 'た', names: ['台湾映画社','台湾映画同好会','タキオンジャパン','田中千世子事務所','旦々舎'] },
  { heading: 'だ', names: ['大映','大映洋画部','大福','ダゲレオ出版','ダッサイ・フィルムズ','dan'] },
  { heading: 'ち', names: ['小さな映画','チェスキー・ケー','チャイルド・フィルム','チャンス イン','チームジョイ'] },
  { heading: 'つ', names: ['ツイン','ツインエンジン','円谷プロダクション'] },
  { heading: 'て', names: ['ティ・ジョイ','テツヤトミナフィルム','テレビ東京','テレビマンユニオン','テンダープロ'] },
  { heading: 'で', names: ['Diggin\'','ディスクユニオン','デイヴィッド・リンチ　プロジェクト','デジタルSKIPステーション','デスペラード','電通クリエイティブピクチャーズ'] },
  { heading: 'と', names: ['東映','東映アニメーション','東映エージエンシー','東映ビデオ','東海テレビ放送','東京テアトル','東京テアトル=ザナドゥー','東芝エンタテインメント','東風','東宝','東宝映像事業部','東宝東和','東北新社','東和','東和ピクチャーズ','トキメディアワークス','トムス・エンタテインメント','豊田組','トライアングルCプロジェクト','トライスター映画','トランスフォーマー','トラヴィス','トリウッド','トリプルアップ','トレノバ','towaie'] },
  { heading: 'ど', names: ['ドゥヴィネット','doodler','ドキュメンタリー・ドリームセンター','ドッグシュガー','ドマ','Drunken Bird','Donuts Films'] },
  { heading: 'な', names: ['ナカチカピクチャーズ','NOTHING NEW','ナミキリズム'] },
  { heading: 'に', names: ['ニコニコフィルム','20世紀フォックス映画','日活','にっかつ','ニチホランド','日本RKO','日本電波ニュース社','日本ヘラルド映画','日本ヘラルド=オフィス北野','Nuiavan','ニューゲーツ','ニューディアー'] },
  { heading: 'ね', names: ['ネツゲン'] },
  { heading: 'の', names: ['ノアド','ノッカ','ノンデライコ','north cky','ノーム'] },
  { heading: 'は', names: ['花三','ハピネット','ハピネットファントム・スタジオ','ハマジム','浜松市民映画館シネマイーラ','ハリウッド・クラシックス','春巻号','半円フィルムズ','反射光','ハンドメイドピクチャーズ','BY4M STUDIO'] },
  { heading: 'ば', names: ['BASARA','バップ','BABEL LABEL','BABELO','バリオン','バンダイナムコアーツ','バンダイナムコピクチャーズ','バンダイナムコフィルムワークス','バーズフィルム'] },
  { heading: 'ぱ', names: ['パブリックアーツ','パラマウント・ピクチャーズ','パル企画','パルコ','パンドラ'] },
  { heading: 'ひ', names: ['ひと夏の冒険出版','ヒューマックス・ピクチャーズ＝ギャガ・コミュニケーションズ','HumanPictures'] },
  { heading: 'び', names: ['ビターズ・エンド','ビックウエスト','ビデオプランニング','ビーズインターナショナル'] },
  { heading: 'ぴ', names: ['ピクチャーズデプト','ピクチャーズ・デプト','ピックス','PIC映像事務所'] },
  { heading: 'ふ', names: ['ファインフィルムズ','ファントム・フィルム','フィールドワークス','フェイス・トゥ・フェイス','フジヤマコム','フューレック','フラッグ','フランス映画社','フリッカポイカ','フリック','フリークスムービー','フリーマン・オフィス','フルモテルモ','ふればり','フロンティアワークス'] },
  { heading: 'ぶ', names: ['ブエナビスタ','ブエナビスタインターナショナル','ブエナワイカ','ブシロードムーブ','ブライトホース・フィルム','BLUE.MOUNTAIN','ブロードウェイ','ブロードメディア','ブロードメディア・スタジオ','Bunkamura'] },
  { heading: 'ぷ', names: ['プライムウェーブ','プラントフィルムズエンタテインメント','Primo Vere','プルーク','プレシディオ','プロジェクトラム','プンクテ'] },
  { heading: 'へ', names: ['平成プロジェクト','ヘラルド','ヘラルド・エース','ヘラルド・エース＝日本ヘラルド映画'] },
  { heading: 'べ', names: ['ベストブレーン','BasicCinema'] },
  { heading: 'ほ', names: ['ホリプロ','boid','BOTA','ポッシブルフィルムズ','ポニーキャニオン','ポルトレ','ポレポレタイムス社','ポレポレ東中野'] },
  { heading: 'ま', names: ['マイウェイムービーズ','マイナーリーグ','マクザム','マグネタイズ','マジックアワー','「街の上で」 フィルムパートナーズ','まちのレコード','MAPPA','MAP','MAM FILM','MANGAZOO.COM','Mark Bookman Foundation','マーチ','murmur','マーメイドフィルム'] },
  { heading: 'み', names: ['ミステリーピクチャーズ','ミカタ・エンタテインメント','ミッドシップ','MinyMixCreati部','ミモザフィルムズ','ミュート','未来映画社','ミラクルヴォイス'] },
  { heading: 'む', names: ['夢何生','武蔵野エンタテインメント','武蔵野興業','ムヴィオラ','ムービック','ムービーアイ','ムービー・アクト・プロジェクト','ムービーウォーカー','ムーランプロモーション','ムーリンプロダクション'] },
  { heading: 'め', names: ['メディア・スーツ','メディアファクトリー','Memento Film Club','メリーサン','面白映画','メ～テレ'] },
  { heading: 'も', names: ['モンタージュ','モービー・ディック'] },
  { heading: 'や', names: ['役式','ヤマハミュージックエンタテインメントホールディングス'] },
  { heading: 'ゆ', names: ['ユナイテッドエンタテインメント','ユナイテッド・シネマ','ユナイテッドピープル','ユナイト映画','ユニバーサル映画','ユニヴァーサル','ユニヴァーサル＝CIC','ユニヴァーサル＝UIP','ユーステール','ufotable','ユーラシアビジョン','ユーロスペース'] },
  { heading: 'よ', names: ['ヨアケ','よしもとクリエイティブ・エージェンシー','吉本興業','読売テレビ'] },
  { heading: 'ら', names: ['ライツキューブ','ライトフィルム','ライブ・ビューイング・ジャパン','樂舎','Rakuten Distribution','ラジオ下神白','ラテンビート','ラビットハウス'] },
  { heading: 'り', names: ['リアリーライクフィルムズ','リスキット','リトルモア','リベロ'] },
  { heading: 'る', names: ['LUDIQUE'] },
  { heading: 'れ', names: ['レイドバック・コーポレーション','レスペ','レックスエンタテインメント','レッドビーンズピクチャーズ','レプロエンタテインメント','Label Betty'] },
  { heading: 'ろ', names: ['ロックウェルアイズ','ロックンロール・マウンテン','ロッコク・キッチン・プロジェクト事務局','ロングライド','ローソン','ローソン・ユナイテッドシネマ'] },
  { heading: 'わ', names: ['ワイズポリシー','若松プロダクション','ワノユメ','One Goose','one\'s','ワン・ポイント・シックス','ワーナー','ワーナー・ブラザース・セブン・アーツ','ワーナー・ブラザース映画'] },
  { heading: 'ヴ', names: ['ヴィジュアルフォークロア'] },
  { heading: 'その他', names: ['映日果人','泰閣映畫'] },
]

const TABS: { key: TabKey; label: string }[] = [
  { key: 'movie', label: '映画' },
  { key: 'drama', label: 'ドラマ' },
  { key: 'anime', label: 'アニメ' },
]

// Styles
const S = {
  page: {
    padding: '0 0 32px',
    background: '#0a0b14',
    minHeight: '100vh',
    color: '#e0e0f0',
  } as React.CSSProperties,
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #1e1f36',
    marginBottom: 0,
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
    background: '#0a0b14',
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '14px 0',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: active ? 700 : 500,
    color: active ? '#a29bfe' : '#8888a8',
    background: 'none',
    border: 'none',
    borderBottom: active ? '3px solid #6c5ce7' : '3px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }),
  searchWrap: {
    padding: '16px 16px 0',
    marginBottom: 16,
  } as React.CSSProperties,
  searchInput: {
    width: '100%',
    padding: '13px 16px 13px 44px',
    borderRadius: 12,
    border: '1px solid #2a2b46',
    background: '#12132a',
    color: '#e0e0f0',
    fontSize: 15,
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as React.CSSProperties,
  searchIcon: {
    position: 'absolute' as const,
    left: 30,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 18,
    color: '#6c5ce7',
    pointerEvents: 'none' as const,
  } as React.CSSProperties,
  clearBtn: {
    position: 'absolute' as const,
    right: 28,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#8888a8',
    cursor: 'pointer',
    fontSize: 20,
    lineHeight: 1,
    padding: 4,
  } as React.CSSProperties,
  sectionHeader: {
    fontSize: 16,
    fontWeight: 700,
    padding: '20px 16px 10px',
    color: '#e0e0f0',
  } as React.CSSProperties,
  scrollRow: {
    display: 'flex',
    overflowX: 'auto' as const,
    overflowY: 'hidden' as const,
    gap: 12,
    padding: '0 16px 8px',
    scrollbarWidth: 'none' as const,
  } as React.CSSProperties,
  posterCard: {
    flexShrink: 0,
    width: 130,
    cursor: 'pointer',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#12132a',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  } as React.CSSProperties,
  posterImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  } as React.CSSProperties,
  noImg: {
    width: '100%',
    height: '100%',
    background: '#1a1b36',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 32,
    color: '#4a4b66',
  } as React.CSSProperties,
  badge: (type: 'movie' | 'tv'): React.CSSProperties => ({
    position: 'absolute',
    top: 6,
    left: 6,
    padding: '2px 6px',
    borderRadius: 4,
    background: type === 'movie' ? 'rgba(108,92,231,0.9)' : 'rgba(46,204,138,0.9)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
  }),
  score: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'rgba(0,0,0,0.75)',
    color: '#ffd700',
    fontSize: 11,
    fontWeight: 700,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#e0e0f0',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  cardSub: {
    fontSize: 11,
    color: '#8888a8',
  } as React.CSSProperties,
  genreGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8,
    padding: '0 16px 8px',
  } as React.CSSProperties,
  genrePill: (selected: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 24,
    border: `1px solid ${selected ? '#6c5ce7' : '#2a2b46'}`,
    background: selected ? 'rgba(108,92,231,0.2)' : '#12132a',
    color: selected ? '#a29bfe' : '#c0c0d8',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  }),
  decadeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8,
    padding: '0 16px 8px',
  } as React.CSSProperties,
  decadePill: {
    padding: '10px 14px',
    borderRadius: 24,
    border: '1px solid #2a2b46',
    background: '#12132a',
    color: '#c0c0d8',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: 12,
    padding: '0 16px',
  } as React.CSSProperties,
  gridCard: {
    cursor: 'pointer',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#12132a',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  } as React.CSSProperties,
  loadMoreBtn: {
    display: 'block',
    margin: '20px auto 0',
    padding: '12px 40px',
    borderRadius: 24,
    border: '1px solid #6c5ce7',
    background: 'transparent',
    color: '#a29bfe',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    margin: '16px 16px 0',
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid #2a2b46',
    background: '#12132a',
    color: '#a29bfe',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  skeleton: {
    aspectRatio: '2/3',
    background: 'linear-gradient(110deg, #12132a 30%, #1e1f36 50%, #12132a 70%)',
    backgroundSize: '200% 100%',
    borderRadius: 10,
    animation: 'shimmer 1.5s infinite linear',
  } as React.CSSProperties,
  emptyState: {
    textAlign: 'center' as const,
    padding: '48px 20px',
    color: '#8888a8',
  } as React.CSSProperties,
} as const

export default function Search({ userId, onOpenWork }: {
  userId: string
  onOpenWork: (id: number, type?: 'movie' | 'tv') => void
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('movie')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TMDBItem[]>([])
  const [searchPage, setSearchPage] = useState(1)
  const [searchTotalPages, setSearchTotalPages] = useState(1)
  const [searchLoading, setSearchLoading] = useState(false)

  // Section data for browsing
  const [sections, setSections] = useState<Record<string, SectionData>>({})

  // Browse state for genre/year drill-down
  const [browse, setBrowse] = useState<BrowseState>({
    mode: 'home', label: '', items: [], loading: false, page: 1, totalPages: 1,
  })

  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // --- Helpers ---
  const getTitle = (r: TMDBItem): string => r.title || r.name || ''
  const getYear = (r: TMDBItem): string => (r.release_date || r.first_air_date || '').substring(0, 4)
  const getType = (r: TMDBItem): 'movie' | 'tv' => r.media_type === 'movie' ? 'movie' : 'tv'
  const formatScore = (v: number): string => (v / 2).toFixed(1)

  // --- Fetchers ---
  const fetchSection = useCallback(async (key: string, title: string, url: string, mediaType?: 'movie' | 'tv') => {
    setSections(prev => ({ ...prev, [key]: { title, items: prev[key]?.items || [], loading: true } }))
    try {
      const res = await fetch(url)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || mediaType || 'movie',
      }))
      setSections(prev => ({ ...prev, [key]: { title, items, loading: false } }))
    } catch {
      setSections(prev => ({ ...prev, [key]: { title, items: [], loading: false } }))
    }
  }, [])

  // Load sections when tab changes
  useEffect(() => {
    if (debouncedQuery || browse.mode !== 'home') return
    setSections({})

    if (activeTab === 'movie') {
      fetchSection('trending_movie', '今注目の映画', '/api/tmdb?action=trending&media_type=movie', 'movie')
      fetchSection('now_playing', '上映中', '/api/tmdb?action=now_playing', 'movie')
      fetchSection('upcoming', '公開予定', '/api/tmdb?action=upcoming', 'movie')
    } else if (activeTab === 'drama') {
      fetchSection('trending_tv', '今注目のドラマ', '/api/tmdb?action=trending&media_type=tv', 'tv')
      fetchSection('jp_drama', '日本のドラマ', '/api/tmdb?action=discover&type=tv&with_origin_country=JP&sort_by=popularity.desc', 'tv')
      fetchSection('kr_drama', '韓国ドラマ', '/api/tmdb?action=discover&type=tv&with_origin_country=KR&sort_by=popularity.desc', 'tv')
      fetchSection('us_drama', '海外ドラマ', '/api/tmdb?action=discover&type=tv&with_origin_country=US&sort_by=popularity.desc', 'tv')
    } else if (activeTab === 'anime') {
      fetchSection('trending_anime', '今注目のアニメ', '/api/tmdb?action=discover&type=tv&with_genres=16&sort_by=popularity.desc', 'tv')
      fetchSection('airing_anime', '放送中', '/api/tmdb?action=on_the_air', 'tv')
      fetchSection('annict_season', '今期のアニメ (Annict)', '/api/tmdb?action=annict_season', 'tv')
    }
  }, [activeTab, debouncedQuery, browse.mode, fetchSection])

  // Client-side search cache (query -> { results, total_pages })
  const searchCacheRef = useRef<Map<string, { results: TMDBItem[]; total_pages: number }>>(new Map())

  // Debounced search (200ms for snappier feel)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setDebouncedQuery('')
      setSearchResults([])
      setSearchPage(1)
      setSearchTotalPages(1)
      return
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Execute search when debouncedQuery changes (keep previous results while loading)
  useEffect(() => {
    if (!debouncedQuery) return

    // Return cached results instantly if available
    const cached = searchCacheRef.current.get(debouncedQuery)
    if (cached) {
      setSearchResults(cached.results)
      setSearchTotalPages(cached.total_pages)
      setSearchPage(1)
      return
    }

    setSearchLoading(true)
    setSearchPage(1)

    // TMDB検索 + アニメタブならAnnict検索も並列実行
    const fetches: Promise<unknown>[] = [
      fetch(`/api/tmdb?action=search&query=${encodeURIComponent(debouncedQuery)}&page=1`).then(r => r.json()),
    ]
    if (activeTab === 'anime') {
      fetches.push(
        fetch(`/api/tmdb?action=annict_search&query=${encodeURIComponent(debouncedQuery)}`).then(r => r.json()).catch(() => ({ results: [] }))
      )
    }

    Promise.all(fetches)
      .then(([tmdbData, annictData]: unknown[]) => {
        const tmdb = tmdbData as { results?: TMDBItem[]; total_pages?: number }
        const results = tmdb.results || []
        const total_pages = tmdb.total_pages || 1

        // Annict結果をマージ（TMDB IDと重複しないもののみ）
        if (annictData) {
          const annict = annictData as { results?: TMDBItem[] }
          const tmdbIds = new Set(results.map(r => r.id))
          const annictUnique = (annict.results || []).filter(r => !tmdbIds.has(r.id))
          results.push(...annictUnique)
        }

        searchCacheRef.current.set(debouncedQuery, { results, total_pages })
        setSearchResults(results)
        setSearchTotalPages(total_pages)
      })
      .catch(() => {})
      .finally(() => setSearchLoading(false))
  }, [debouncedQuery, activeTab])

  const loadMoreSearch = async () => {
    const nextPage = searchPage + 1
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/tmdb?action=search&query=${encodeURIComponent(debouncedQuery)}&page=${nextPage}`)
      const data = await res.json()
      setSearchResults(prev => [...prev, ...(data.results || [])])
      setSearchPage(nextPage)
      setSearchTotalPages(data.total_pages || 1)
    } catch { /* ignore */ }
    setSearchLoading(false)
  }

  // --- Genre / Year browsing ---
  const browseGenre = async (genreId: number, genreName: string, page: number = 1) => {
    const mediaType = activeTab === 'movie' ? 'movie' : 'tv'
    const extraGenre = activeTab === 'anime' ? `16,${genreId}` : String(genreId)
    setBrowse({ mode: 'genre', label: genreName, items: page === 1 ? [] : browse.items, loading: true, page, totalPages: 1 })
    try {
      const res = await fetch(`/api/tmdb?action=discover&type=${mediaType}&with_genres=${extraGenre}&page=${page}&sort_by=popularity.desc`)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || mediaType,
      }))
      setBrowse(prev => ({
        ...prev,
        items: page === 1 ? items : [...prev.items, ...items],
        loading: false,
        page,
        totalPages: data.total_pages || 1,
      }))
    } catch {
      setBrowse(prev => ({ ...prev, loading: false }))
    }
  }

  const browseYear = async (year: number, page: number = 1) => {
    const label = `${year}年`
    const gte = `${year}-01-01`
    const lte = `${year}-12-31`
    const mediaType = activeTab === 'movie' ? 'movie' : 'tv'
    const dateKey = mediaType === 'movie' ? 'primary_release_date' : 'first_air_date'
    setBrowse({ mode: 'year', label, items: page === 1 ? [] : browse.items, loading: true, page, totalPages: 1 })
    try {
      const res = await fetch(`/api/tmdb?action=discover&type=${mediaType}&${dateKey}.gte=${gte}&${dateKey}.lte=${lte}&page=${page}&sort_by=popularity.desc`)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || mediaType,
      }))
      setBrowse(prev => ({
        ...prev,
        items: page === 1 ? items : [...prev.items, ...items],
        loading: false,
        page,
        totalPages: data.total_pages || 1,
      }))
    } catch {
      setBrowse(prev => ({ ...prev, loading: false }))
    }
  }

  const browseProvider = async (providerId: number, providerName: string, page: number = 1) => {
    const mediaType = activeTab === 'movie' ? 'movie' : 'tv'
    setBrowse({ mode: 'provider', label: providerName, items: page === 1 ? [] : browse.items, loading: true, page, totalPages: 1 })
    try {
      const res = await fetch(`/api/tmdb?action=discover&type=${mediaType}&with_watch_providers=${providerId}&with_watch_monetization_types=flatrate&page=${page}&sort_by=popularity.desc`)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || mediaType,
      }))
      setBrowse(prev => ({
        ...prev,
        items: page === 1 ? items : [...prev.items, ...items],
        loading: false,
        page,
        totalPages: data.total_pages || 1,
      }))
    } catch {
      setBrowse(prev => ({ ...prev, loading: false }))
    }
  }

  const browseAward = async (award: typeof AWARDS[number], page: number = 1) => {
    const label = `${award.emoji} ${award.name}`
    setBrowse({ mode: 'award', label, items: page === 1 ? [] : browse.items, loading: true, page, totalPages: 1 })
    try {
      let url = `/api/tmdb?action=discover&type=movie&sort_by=${award.sort}&vote_count.gte=${award.voteMin}&page=${page}`
      if (award.voteAvgMin) url += `&vote_average.gte=${award.voteAvgMin}`
      if (award.voteMax) url += `&vote_count.lte=${award.voteMax}`
      if (award.country) url += `&with_origin_country=${award.country}`
      const res = await fetch(url)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || 'movie',
      }))
      setBrowse(prev => ({
        ...prev,
        items: page === 1 ? items : [...prev.items, ...items],
        loading: false,
        page,
        totalPages: data.total_pages || 1,
      }))
    } catch {
      setBrowse(prev => ({ ...prev, loading: false }))
    }
  }

  const browseCountry = async (countryCode: string, countryName: string, page: number = 1) => {
    const mediaType = activeTab === 'movie' ? 'movie' : 'tv'
    setBrowse({ mode: 'country', label: countryName, items: page === 1 ? [] : browse.items, loading: true, page, totalPages: 1 })
    try {
      const res = await fetch(`/api/tmdb?action=discover&type=${mediaType}&with_origin_country=${countryCode}&page=${page}&sort_by=popularity.desc`)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || mediaType,
      }))
      setBrowse(prev => ({
        ...prev,
        items: page === 1 ? items : [...prev.items, ...items],
        loading: false,
        page,
        totalPages: data.total_pages || 1,
      }))
    } catch {
      setBrowse(prev => ({ ...prev, loading: false }))
    }
  }

  const browseCompany = async (companyName: string, page: number = 1) => {
    setBrowse({ mode: 'company', label: companyName, items: page === 1 ? [] : browse.items, loading: true, page, totalPages: 1 })
    try {
      // Check if we have a known TMDB ID
      let companyId = COMPANY_ID_MAP[companyName]
      if (!companyId) {
        // Search TMDB for the company by name
        const searchRes = await fetch(`/api/tmdb?action=search_company&query=${encodeURIComponent(companyName)}`)
        const searchData = await searchRes.json()
        companyId = searchData.results?.[0]?.id
      }
      if (!companyId) {
        setBrowse(prev => ({ ...prev, loading: false, items: [] }))
        return
      }
      const res = await fetch(`/api/tmdb?action=discover&type=movie&with_companies=${companyId}&page=${page}&sort_by=popularity.desc`)
      const data = await res.json()
      const items: TMDBItem[] = (data.results || []).map((item: TMDBItem) => ({
        ...item,
        media_type: item.media_type || 'movie',
      }))
      setBrowse(prev => ({
        ...prev,
        items: page === 1 ? items : [...prev.items, ...items],
        loading: false,
        page,
        totalPages: data.total_pages || 1,
      }))
    } catch {
      setBrowse(prev => ({ ...prev, loading: false }))
    }
  }

  const goBackToHome = () => {
    setBrowse({ mode: 'home', label: '', items: [], loading: false, page: 1, totalPages: 1 })
  }

  // --- Filter anime airing results ---
  const filterAnimeItems = (items: TMDBItem[]): TMDBItem[] => {
    if (activeTab !== 'anime') return items
    return items.filter(item => item.genre_ids?.includes(16))
  }

  // --- Render helpers ---
  const renderPosterCard = (item: TMDBItem, inGrid: boolean = false) => {
    const type = getType(item)
    const score = item.vote_average > 0 ? formatScore(item.vote_average) : null
    const style = inGrid ? S.gridCard : S.posterCard

    return (
      <div
        key={`${item.media_type || 'item'}-${item.id}`}
        style={style}
        onClick={() => onOpenWork(item.id, type)}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(108,92,231,0.3)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
        }}
      >
        <div style={{ position: 'relative', aspectRatio: '2/3' }}>
          {item.poster_path ? (
            <img
              src={item.poster_path.startsWith('http') ? item.poster_path : `${TMDB_IMG}/w342${item.poster_path}`}
              alt={getTitle(item)}
              style={S.posterImg}
              loading="lazy"
            />
          ) : (
            <div style={S.noImg}>🎬</div>
          )}
          <span style={S.badge(type)}>
            {type === 'movie' ? '映画' : 'TV'}
          </span>
          {score && (
            <span style={S.score}>★{score}</span>
          )}
        </div>
        <div style={{ padding: '8px 8px 10px' }}>
          <div style={S.cardTitle}>{getTitle(item)}</div>
          <div style={S.cardSub}>{getYear(item)}</div>
        </div>
      </div>
    )
  }

  const renderSkeletonRow = () => (
    <div style={{ ...S.scrollRow, overflowX: 'hidden' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 130 }}>
          <div style={S.skeleton} />
          <div style={{ height: 12, width: '70%', background: '#1e1f36', borderRadius: 4, marginTop: 8 }} />
        </div>
      ))}
    </div>
  )

  const renderSkeletonGrid = () => (
    <div style={S.grid}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={S.skeleton} />
      ))}
    </div>
  )

  const renderScrollSection = (key: string) => {
    const section = sections[key]
    if (!section) return null

    return (
      <div key={key}>
        <div style={S.sectionHeader}>{section.title}</div>
        {section.loading ? renderSkeletonRow() : (
          <div style={S.scrollRow}>
            {(activeTab === 'anime' && key === 'airing_anime' ? filterAnimeItems(section.items) : section.items)
              .slice(0, 20)
              .map(item => renderPosterCard(item))}
          </div>
        )}
      </div>
    )
  }

  // --- Filmarks-style link item ---
  const linkItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 16px',
    background: 'none', border: 'none', borderBottom: '1px solid #1e1f36',
    color: '#e0e0f0', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', width: '100%', textAlign: 'left',
    transition: 'background 0.15s',
  }
  const linkArrow: React.CSSProperties = {
    marginLeft: 'auto', color: '#4a4b66', fontSize: 14,
  }

  const renderGenreChips = () => {
    const genres = activeTab === 'movie' ? MOVIE_GENRES
      : activeTab === 'drama' ? TV_GENRES
      : ANIME_GENRES

    return (
      <div style={{ margin: '20px 16px 0', background: '#12132a', borderRadius: 12, border: '1px solid #1e1f36', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 15, color: '#e0e0f0', borderBottom: '1px solid #1e1f36' }}>ジャンルで探す</div>
        {genres.map(g => (
          <button
            key={g.id}
            style={linkItemStyle}
            onClick={() => browseGenre(g.id, `${g.emoji} ${g.name}`)}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          >
            <span>{g.emoji}</span>
            <span>{g.name}</span>
            <span style={linkArrow}>›</span>
          </button>
        ))}
      </div>
    )
  }

  const renderDecadeButtons = () => (
    <div style={{ margin: '20px 16px 0', background: '#12132a', borderRadius: 12, border: '1px solid #1e1f36', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 15, color: '#e0e0f0', borderBottom: '1px solid #1e1f36' }}>製作年で探す</div>
      {DECADES.map(d => {
        const years: number[] = []
        for (let y = d.end; y >= d.start; y--) years.push(y)
        return (
          <div key={d.label} style={{ borderBottom: '1px solid #1e1f36' }}>
            <div style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#a29bfe' }}>{d.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, paddingBottom: 8 }}>
              {years.map(y => (
                <button
                  key={y}
                  style={{
                    background: 'none', border: 'none', color: '#c0c0d8', fontSize: 13,
                    padding: '4px 12px', cursor: 'pointer', transition: 'color 0.15s',
                  }}
                  onClick={() => browseYear(y)}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#a29bfe' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#c0c0d8' }}
                >
                  {y}年
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderProviderChips = () => (
    <div style={{ margin: '20px 16px 0', background: '#12132a', borderRadius: 12, border: '1px solid #1e1f36', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 15, color: '#e0e0f0', borderBottom: '1px solid #1e1f36', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>動画配信サービスで探す</span>
        <span style={{ fontSize: 12, color: '#8888a8', fontWeight: 400 }}>{PROVIDERS.length}サービス</span>
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', gap: 12, padding: '16px', scrollbarWidth: 'none' }}>
        {PROVIDERS.map(p => (
          <button
            key={p.name}
            onClick={() => p.id > 0 ? browseProvider(p.id, `${p.emoji} ${p.name}`) : browseProvider(0, `${p.emoji} ${p.name}`)}
            style={{
              flexShrink: 0, width: 150, padding: '16px 12px',
              background: '#0d0e1e', borderRadius: 12,
              border: '1px solid #2a2b46', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              transition: 'border-color 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#6c5ce7'
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2b46'
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
            }}
          >
            <span style={{ fontSize: 28 }}>{p.emoji}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e0e0f0', textAlign: 'center', lineHeight: 1.3 }}>{p.name}</span>
            <span style={{ fontSize: 11, color: '#8888a8', textAlign: 'center', lineHeight: 1.3 }}>{p.desc}</span>
          </button>
        ))}
      </div>
      {/* Also show as list below cards */}
      {PROVIDERS.map(p => (
        <button
          key={`list-${p.name}`}
          style={linkItemStyle}
          onClick={() => p.id > 0 ? browseProvider(p.id, `${p.emoji} ${p.name}`) : browseProvider(0, `${p.emoji} ${p.name}`)}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.08)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
        >
          <span>{p.emoji}</span>
          <span style={{ flex: 1 }}>{p.name}</span>
          <span style={{ fontSize: 11, color: '#8888a8' }}>{p.desc}</span>
          <span style={linkArrow}>›</span>
        </button>
      ))}
    </div>
  )

  const [awardExpanded, setAwardExpanded] = useState(false)

  const renderAwardChips = () => {
    const displayAwards = awardExpanded ? AWARDS : AWARDS.slice(0, 12)
    return (
      <div style={{ margin: '20px 16px 0', background: '#12132a', borderRadius: 12, border: '1px solid #1e1f36', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 15, color: '#e0e0f0', borderBottom: '1px solid #1e1f36', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>映画賞・映画祭で探す</span>
          <span style={{ fontSize: 12, color: '#8888a8', fontWeight: 400 }}>{AWARDS.length}件</span>
        </div>
        {displayAwards.map(a => (
          <button
            key={a.name}
            style={linkItemStyle}
            onClick={() => browseAward(a)}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          >
            <span>{a.emoji}</span>
            <span>{a.name}</span>
            <span style={linkArrow}>›</span>
          </button>
        ))}
        {!awardExpanded && AWARDS.length > 12 && (
          <button
            onClick={() => setAwardExpanded(true)}
            style={{
              width: '100%', padding: '14px', background: 'none', border: 'none',
              borderTop: '1px solid #1e1f36', color: '#a29bfe', fontSize: 14,
              fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          >
            すべての映画賞を表示 ({AWARDS.length}件) ›
          </button>
        )}
        {awardExpanded && (
          <button onClick={() => setAwardExpanded(false)} style={{ width: '100%', padding: '14px', background: 'none', border: 'none', borderTop: '1px solid #1e1f36', color: '#8888a8', fontSize: 13, cursor: 'pointer' }}>閉じる</button>
        )}
      </div>
    )
  }

  const [countryFilter, setCountryFilter] = useState('')
  const [countryExpanded, setCountryExpanded] = useState(false)

  const renderCountryChips = () => {
    const filtered = countryFilter.trim()
      ? COUNTRIES.filter(c => c.name.includes(countryFilter) || c.code.toLowerCase().includes(countryFilter.toLowerCase()))
      : COUNTRIES
    const INITIAL_COUNT = 20 // 主要国のみ最初に表示
    const displayCountries = countryExpanded || countryFilter ? filtered : filtered.slice(0, INITIAL_COUNT)

    return (
      <div style={{ margin: '20px 16px 0', background: '#12132a', borderRadius: 12, border: '1px solid #1e1f36', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 15, color: '#e0e0f0', borderBottom: '1px solid #1e1f36', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>製作国・地域で探す</span>
          <span style={{ fontSize: 12, color: '#8888a8', fontWeight: 400 }}>{COUNTRIES.length}カ国・地域</span>
        </div>
        {/* Search filter */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e1f36' }}>
          <input
            value={countryFilter}
            onChange={e => { setCountryFilter(e.target.value); setCountryExpanded(true) }}
            placeholder="国名で絞り込み..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid #2a2b46', background: '#0d0e1e', color: '#e0e0f0',
              fontSize: 13, boxSizing: 'border-box', outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#6c5ce7' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#2a2b46' }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {displayCountries.map(c => (
            <button
              key={c.code}
              style={{ ...linkItemStyle, borderRight: '1px solid #1e1f36' }}
              onClick={() => browseCountry(c.code, c.name)}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              <span style={{ fontSize: 13 }}>{c.name}</span>
              <span style={linkArrow}>›</span>
            </button>
          ))}
        </div>
        {!countryExpanded && !countryFilter && filtered.length > INITIAL_COUNT && (
          <button
            onClick={() => setCountryExpanded(true)}
            style={{
              width: '100%', padding: '14px', background: 'none', border: 'none',
              borderTop: '1px solid #1e1f36', color: '#a29bfe', fontSize: 14,
              fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          >
            すべての国・地域を表示 ({COUNTRIES.length}件) ›
          </button>
        )}
        {countryExpanded && !countryFilter && (
          <button onClick={() => setCountryExpanded(false)} style={{ width: '100%', padding: '14px', background: 'none', border: 'none', borderTop: '1px solid #1e1f36', color: '#8888a8', fontSize: 13, cursor: 'pointer' }}>閉じる</button>
        )}
        {countryFilter && filtered.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#8888a8', fontSize: 13 }}>
            「{countryFilter}」に一致する国・地域がありません
          </div>
        )}
      </div>
    )
  }

  const [companyFilter, setCompanyFilter] = useState('')
  const [companyExpanded, setCompanyExpanded] = useState(false)

  const renderCompanyChips = () => {
    const filtered = companyFilter.trim()
      ? DISTRIBUTORS.map(g => ({
          ...g,
          names: g.names.filter(n => n.toLowerCase().includes(companyFilter.toLowerCase())),
        })).filter(g => g.names.length > 0)
      : DISTRIBUTORS

    const displayGroups = companyExpanded ? filtered : filtered.slice(0, 5)

    return (
      <div style={{ margin: '20px 16px 0', background: '#12132a', borderRadius: 12, border: '1px solid #1e1f36', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', fontWeight: 700, fontSize: 15, color: '#e0e0f0', borderBottom: '1px solid #1e1f36', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>配給会社で探す</span>
          <span style={{ fontSize: 12, color: '#8888a8', fontWeight: 400 }}>
            {DISTRIBUTORS.reduce((sum, g) => sum + g.names.length, 0)}社
          </span>
        </div>
        {/* Search filter */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e1f36' }}>
          <input
            value={companyFilter}
            onChange={e => { setCompanyFilter(e.target.value); setCompanyExpanded(true) }}
            placeholder="配給会社名で絞り込み..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid #2a2b46', background: '#0d0e1e', color: '#e0e0f0',
              fontSize: 13, boxSizing: 'border-box', outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#6c5ce7' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#2a2b46' }}
          />
        </div>
        {/* Grouped distributor list */}
        {displayGroups.map(group => (
          <div key={group.heading}>
            <div style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#a29bfe',
              background: '#0d0e1e', borderBottom: '1px solid #1e1f36',
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              {group.heading}
            </div>
            {group.names.map(name => (
              <button
                key={name}
                style={linkItemStyle}
                onClick={() => browseCompany(name)}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                <span style={{ fontSize: 13 }}>{name}</span>
                <span style={linkArrow}>›</span>
              </button>
            ))}
          </div>
        ))}
        {!companyExpanded && !companyFilter && filtered.length > 5 && (
          <button
            onClick={() => setCompanyExpanded(true)}
            style={{
              width: '100%', padding: '14px', background: 'none', border: 'none',
              borderTop: '1px solid #1e1f36', color: '#a29bfe', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
          >
            すべての配給会社を表示 ›
          </button>
        )}
        {companyExpanded && !companyFilter && (
          <button
            onClick={() => setCompanyExpanded(false)}
            style={{
              width: '100%', padding: '14px', background: 'none', border: 'none',
              borderTop: '1px solid #1e1f36', color: '#8888a8', fontSize: 13,
              cursor: 'pointer',
            }}
          >
            閉じる
          </button>
        )}
        {companyFilter && filtered.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#8888a8', fontSize: 13 }}>
            「{companyFilter}」に一致する配給会社がありません
          </div>
        )}
      </div>
    )
  }

  // --- Search results view ---
  const renderSearchView = () => {
    const filtered = searchResults.filter(r => {
      const isAnnict = !!(r as Record<string, unknown>)._annict
      if (!r.poster_path && !isAnnict) return false
      if (activeTab === 'movie') return r.media_type === 'movie'
      if (activeTab === 'drama') return r.media_type === 'tv' && !isAnnict
      if (activeTab === 'anime') return isAnnict || r.media_type === 'tv' || r.genre_ids?.includes(16)
      return true
    })

    return (
      <div>
        {searchLoading && searchResults.length === 0 ? renderSkeletonGrid() : (
          <>
            <div style={S.grid}>
              {filtered.map(item => renderPosterCard(item, true))}
            </div>
            {filtered.length === 0 && !searchLoading && (
              <div style={S.emptyState}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 15 }}>「{debouncedQuery}」に一致する結果がありません</div>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  style={{ marginTop: 16, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--fm-accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  この作品を登録する
                </button>
                <div style={{ fontSize: 12, color: 'var(--fm-text-muted)', marginTop: 8 }}>
                  見つからない作品を登録して記録を始めましょう
                </div>
              </div>
            )}
            {searchPage < searchTotalPages && filtered.length > 0 && (
              <button
                style={S.loadMoreBtn}
                onClick={loadMoreSearch}
                disabled={searchLoading}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.2)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                {searchLoading ? '読み込み中...' : 'もっと見る'}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  // --- Browse results (genre/year drill-down) ---
  const renderBrowseView = () => (
    <div>
      <button style={S.backBtn} onClick={goBackToHome}>
        ← 戻る
      </button>
      <div style={{ ...S.sectionHeader, fontSize: 18 }}>{browse.label}</div>
      {browse.loading && browse.items.length === 0 ? renderSkeletonGrid() : (
        <>
          <div style={S.grid}>
            {browse.items.map(item => renderPosterCard(item, true))}
          </div>
          {browse.page < browse.totalPages && browse.items.length > 0 && (
            <button
              style={S.loadMoreBtn}
              onClick={() => {
                if (browse.mode === 'genre') {
                  const genres = activeTab === 'movie' ? MOVIE_GENRES
                    : activeTab === 'drama' ? TV_GENRES : ANIME_GENRES
                  const found = genres.find(g => browse.label.includes(g.name))
                  if (found) browseGenre(found.id, browse.label, browse.page + 1)
                } else if (browse.mode === 'year') {
                  const yearMatch = browse.label.match(/^(\d{4})年$/)
                  if (yearMatch) browseYear(parseInt(yearMatch[1]), browse.page + 1)
                } else if (browse.mode === 'provider') {
                  const found = PROVIDERS.find(p => browse.label.includes(p.name))
                  if (found) browseProvider(found.id, browse.label, browse.page + 1)
                } else if (browse.mode === 'award') {
                  const found = AWARDS.find(a => browse.label.includes(a.name))
                  if (found) browseAward(found, browse.page + 1)
                } else if (browse.mode === 'country') {
                  const found = COUNTRIES.find(c => browse.label.includes(c.name))
                  if (found) browseCountry(found.code, browse.label, browse.page + 1)
                } else if (browse.mode === 'company') {
                  browseCompany(browse.label, browse.page + 1)
                }
              }}
              disabled={browse.loading}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(108,92,231,0.2)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              {browse.loading ? '読み込み中...' : 'もっと見る'}
            </button>
          )}
        </>
      )}
    </div>
  )

  // --- Home browsing (sections) ---
  const renderHomeView = () => {
    if (activeTab === 'movie') {
      return (
        <>
          {renderScrollSection('trending_movie')}
          {renderScrollSection('now_playing')}
          {renderScrollSection('upcoming')}
          {renderProviderChips()}
          {renderAwardChips()}
          {renderGenreChips()}
          {renderDecadeButtons()}
          {renderCountryChips()}
          {renderCompanyChips()}
        </>
      )
    }
    if (activeTab === 'drama') {
      return (
        <>
          {renderScrollSection('trending_tv')}
          {renderScrollSection('jp_drama')}
          {renderScrollSection('kr_drama')}
          {renderScrollSection('us_drama')}
          {renderProviderChips()}
          {renderGenreChips()}
          {renderCountryChips()}
        </>
      )
    }
    if (activeTab === 'anime') {
      return (
        <>
          {renderScrollSection('trending_anime')}
          {renderScrollSection('airing_anime')}
          {renderProviderChips()}
          {renderGenreChips()}
        </>
      )
    }
    return null
  }

  const isSearching = !!debouncedQuery
  const isBrowsing = browse.mode !== 'home'

  return (
    <div style={S.page}>
      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Category tabs */}
      <div style={S.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            style={S.tab(activeTab === tab.key)}
            onClick={() => {
              setActiveTab(tab.key)
              goBackToHome()
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div style={S.searchWrap}>
        <div style={{ position: 'relative' }}>
          <span style={S.searchIcon}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="作品名・キャスト・キーワードで検索"
            style={S.searchInput}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#6c5ce7'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(108,92,231,0.2)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#2a2b46'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          {query && (
            <button
              style={S.clearBtn}
              onClick={() => { setQuery(''); setSearchResults([]); setDebouncedQuery('') }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isSearching
        ? renderSearchView()
        : isBrowsing
          ? renderBrowseView()
          : renderHomeView()
      }

      {showRegisterModal && (
        <WorkRegisterModal
          userId={userId}
          initialQuery={debouncedQuery || query}
          onClose={() => setShowRegisterModal(false)}
          onOpenWork={onOpenWork}
        />
      )}
    </div>
  )
}
