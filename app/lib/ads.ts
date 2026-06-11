'use client'

/**
 * 広告マネタイズ基盤。
 *
 * プラットフォーム別の出し分け:
 *   - ネイティブアプリ (Capacitor iOS/Android) → AdMob (@capacitor-community/admob)
 *   - Web ブラウザ → AdSense (Auto ads)
 *
 * ポリシー上の重要事項:
 *   - AdSense を WebView (Capacitor アプリ) 内で表示するのは Google ポリシー違反。
 *     ネイティブ判定 (Capacitor.isNativePlatform) で必ず分岐する。
 *     ※ Capacitor は server.url=https://filmo.me の remote 構成なので、
 *       同じページがブラウザと WebView の両方から開かれる。判定は必ず実行時に行う。
 *   - うらにゃん単独アプリ (jp.filmo.uranyan) は App Store 4.3(b) 再審査中のため
 *     広告を一切出さない (審査リスクを増やさない)。
 *
 * ユニット ID は環境変数で注入し、未設定時は Google 公式テスト ID にフォールバック。
 * → 本番設定は docs/ads-setup.md を参照。
 */

import { Capacitor } from '@capacitor/core'
import { getStandaloneAppMode } from './standaloneApp'
import { track } from './analytics'

// ---------------------------------------------------------------
// 設定
// ---------------------------------------------------------------

/** AdSense クライアント ID (例: ca-pub-1234567890123456)。未設定なら Web 広告は無効。 */
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ''

// Google 公式のテストユニット ID (https://developers.google.com/admob/ios|android/test-ads)
const TEST_IDS = {
  bannerIos: 'ca-app-pub-3940256099942544/2934735716',
  bannerAndroid: 'ca-app-pub-3940256099942544/6300978111',
  interstitialIos: 'ca-app-pub-3940256099942544/4411468910',
  interstitialAndroid: 'ca-app-pub-3940256099942544/1033173712',
}

function admobUnitIds() {
  const ios = Capacitor.getPlatform() === 'ios'
  return {
    banner:
      (ios
        ? process.env.NEXT_PUBLIC_ADMOB_BANNER_IOS
        : process.env.NEXT_PUBLIC_ADMOB_BANNER_ANDROID) ||
      (ios ? TEST_IDS.bannerIos : TEST_IDS.bannerAndroid),
    interstitial:
      (ios
        ? process.env.NEXT_PUBLIC_ADMOB_INTERSTITIAL_IOS
        : process.env.NEXT_PUBLIC_ADMOB_INTERSTITIAL_ANDROID) ||
      (ios ? TEST_IDS.interstitialIos : TEST_IDS.interstitialAndroid),
    // 本番ユニット ID が一つも設定されていなければテストモード
    isTesting: !(
      process.env.NEXT_PUBLIC_ADMOB_BANNER_IOS ||
      process.env.NEXT_PUBLIC_ADMOB_BANNER_ANDROID
    ),
  }
}

// インタースティシャルの頻度制御。「ウザい」と感じさせない範囲で収益を最大化する。
// eCPM はバナーの 10〜20 倍なので、ここを丁寧に運用するのが売上の核になる。
const INTERSTITIAL_MIN_INTERVAL_MS = 3 * 60 * 1000 // 前回表示から最低 3 分空ける
const INTERSTITIAL_DAILY_CAP = 8 // 1 日の上限
const NEW_USER_GRACE_MS = 24 * 60 * 60 * 1000 // 初回起動から 24h は全画面広告なし (オンボーディング保護)

// メインアプリの下タブバー (app/page.tsx の <nav>) の高さ。
// バナーはこの分だけ画面下端から浮かせて、タブバーの上に表示する。
const TAB_BAR_HEIGHT_PX = 56

const LS_FIRST_SEEN = 'filmo_ads_first_seen'
const LS_LAST_INTERSTITIAL = 'filmo_ads_last_interstitial'
const LS_DAILY = 'filmo_ads_daily' // `${YYYY-MM-DD}:${count}`

// ---------------------------------------------------------------
// 内部状態
// ---------------------------------------------------------------

let admobReady = false
let bannerCreated = false // showBanner 済み (hide 後は resumeBanner を使う)
let bannerShowing = false
let interstitialPrepared = false
let npa = false // ATT 非許可時は非パーソナライズ広告にする

/** ネイティブアプリで AdMob 広告を出してよい環境か */
export function isNativeAdPlatform(): boolean {
  if (typeof window === 'undefined') return false
  if (!Capacitor.isNativePlatform()) return false
  // うらにゃん単独アプリは審査中のため広告なし
  if (getStandaloneAppMode() === 'uranyan') return false
  return true
}

/** Web ブラウザで AdSense を出してよい環境か */
export function isWebAdPlatform(): boolean {
  if (typeof window === 'undefined') return false
  if (Capacitor.isNativePlatform()) return false // WebView 内 AdSense はポリシー違反
  return Boolean(ADSENSE_CLIENT)
}

function lsGet(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function lsSet(key: string, value: string) {
  try { window.localStorage.setItem(key, value) } catch { /* private mode 等 */ }
}

/** 初回起動時刻を記録し、新規ユーザー保護期間中かを返す */
function inNewUserGrace(): boolean {
  const now = Date.now()
  const first = Number(lsGet(LS_FIRST_SEEN))
  if (!first) {
    lsSet(LS_FIRST_SEEN, String(now))
    return true
  }
  return now - first < NEW_USER_GRACE_MS
}

// ---------------------------------------------------------------
// 初期化
// ---------------------------------------------------------------

let initPromise: Promise<void> | null = null

/**
 * 広告 SDK の初期化。何度呼んでも実体は一度だけ走る (共有 Promise)。
 * ネイティブなら AdMob 初期化 + 同意フロー、Web なら AdSense スクリプト注入。
 */
export function initAds(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      if (isNativeAdPlatform()) {
        await initAdmob()
      } else if (isWebAdPlatform()) {
        injectAdsense()
      }
    })()
  }
  return initPromise
}

async function initAdmob(): Promise<void> {
  if (admobReady) return
  try {
    const { AdMob, AdmobConsentStatus, InterstitialAdPluginEvents } =
      await import('@capacitor-community/admob')
    await AdMob.initialize()

    // 同意フロー:
    //  1. UMP (EEA 向け GDPR 同意) の状態を取得
    //  2. iOS の ATT が未決定なら OS のトラッキング許可ダイアログを表示
    //  3. UMP フォームが必要なら表示
    // 失敗しても広告自体は出せる (npa=true で非パーソナライズ化) ので throw しない。
    try {
      const consentInfo = await AdMob.requestConsentInfo()
      const att = await AdMob.trackingAuthorizationStatus()
      if (att.status === 'notDetermined') {
        await AdMob.requestTrackingAuthorization()
      }
      const attAfter = await AdMob.trackingAuthorizationStatus()
      npa = attAfter.status !== 'authorized'
      if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
        await AdMob.showConsentForm()
      }
    } catch (e) {
      npa = true
      console.warn('[ads] consent flow failed (fallback to npa):', e)
    }

    admobReady = true
    inNewUserGrace() // 初回起動時刻の記録だけ先にしておく

    // インタースティシャルは表示時の待ち時間をなくすため先読みしておく。
    // 閉じられたら次をすぐ準備する。
    await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      interstitialPrepared = false
      void prepareInterstitial()
    })
    void prepareInterstitial()
  } catch (e) {
    // プラグイン未同梱の旧バイナリ (App Store 配布済み) では import/initialize が
    // 失敗するが、アプリ動作には影響させない。
    console.warn('[ads] AdMob init skipped:', e)
  }
}

function injectAdsense(): void {
  if (document.querySelector('script[data-filmo-adsense]')) return
  const s = document.createElement('script')
  s.async = true
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  s.crossOrigin = 'anonymous'
  s.setAttribute('data-filmo-adsense', '1')
  document.head.appendChild(s)
}

// ---------------------------------------------------------------
// バナー (ネイティブ)
// ---------------------------------------------------------------

/**
 * メインアプリのタブバー上にアダプティブバナーを表示する。
 * 表示中は CSS 変数 --filmo-ad-inset にバナー高さが入るので、
 * コンテンツ側は padding-bottom に加算して隠れを防ぐ。
 */
export async function showAppBanner(): Promise<void> {
  if (!isNativeAdPlatform() || !admobReady || bannerShowing) return
  try {
    const { AdMob, BannerAdPosition, BannerAdSize, BannerAdPluginEvents } =
      await import('@capacitor-community/admob')
    const ids = admobUnitIds()

    if (!bannerCreated) {
      await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
        document.documentElement.style.setProperty(
          '--filmo-ad-inset',
          `${info.height > 0 ? info.height : 0}px`,
        )
      })
      await AdMob.showBanner({
        adId: ids.banner,
        isTesting: ids.isTesting,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: TAB_BAR_HEIGHT_PX,
        npa,
      })
      bannerCreated = true
    } else {
      await AdMob.resumeBanner()
    }
    bannerShowing = true
    track('ad_banner_shown', { platform: Capacitor.getPlatform() })
  } catch (e) {
    console.warn('[ads] showBanner failed:', e)
  }
}

export async function hideAppBanner(): Promise<void> {
  if (!bannerShowing) return
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    await AdMob.hideBanner()
  } catch { /* noop */ }
  bannerShowing = false
  document.documentElement.style.setProperty('--filmo-ad-inset', '0px')
}

// ---------------------------------------------------------------
// インタースティシャル (ネイティブ)
// ---------------------------------------------------------------

async function prepareInterstitial(): Promise<void> {
  if (!isNativeAdPlatform() || !admobReady || interstitialPrepared) return
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    const ids = admobUnitIds()
    await AdMob.prepareInterstitial({
      adId: ids.interstitial,
      isTesting: ids.isTesting,
      npa,
    })
    interstitialPrepared = true
  } catch (e) {
    console.warn('[ads] prepareInterstitial failed:', e)
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function dailyCount(): number {
  const raw = lsGet(LS_DAILY)
  if (!raw) return 0
  const [day, count] = raw.split(':')
  return day === todayKey() ? Number(count) || 0 : 0
}

function canShowInterstitial(): boolean {
  if (inNewUserGrace()) return false
  const last = Number(lsGet(LS_LAST_INTERSTITIAL)) || 0
  if (Date.now() - last < INTERSTITIAL_MIN_INTERVAL_MS) return false
  if (dailyCount() >= INTERSTITIAL_DAILY_CAP) return false
  return true
}

/**
 * 自然な区切りタイミング (ゲームの結果画面など) でインタースティシャルを表示する。
 * 頻度制御 (3 分間隔 / 1 日 8 回 / 新規 24h 免除) を内蔵しているので、
 * 呼び出し側は区切りのたびに気軽に呼んでよい。
 *
 * @returns 実際に表示されたら true
 */
export async function maybeShowInterstitial(trigger: string): Promise<boolean> {
  if (!isNativeAdPlatform() || !admobReady) return false
  if (!canShowInterstitial()) return false
  if (!interstitialPrepared) {
    void prepareInterstitial() // 次の機会に備えて準備だけしておく
    return false
  }
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    await AdMob.showInterstitial()
    interstitialPrepared = false
    lsSet(LS_LAST_INTERSTITIAL, String(Date.now()))
    lsSet(LS_DAILY, `${todayKey()}:${dailyCount() + 1}`)
    track('ad_interstitial_shown', { trigger, platform: Capacitor.getPlatform() })
    return true
  } catch (e) {
    console.warn('[ads] showInterstitial failed:', e)
    interstitialPrepared = false
    return false
  }
}
