/**
 * Capacitor config — うらにゃん単独 iOS / Android アプリ用。
 *
 * Filmo 本体 (`capacitor.config.ts`) を base にし、以下を差し替え:
 *   - appId / appName (App Store / Play Store エントリを分けるため)
 *   - server.url (`?app=uranyan` で起動して standaloneApp.ts に検出させる)
 *
 * 使い方:
 *   1. `cp capacitor.uranyan.config.ts capacitor.config.ts` で一時的に切り替え
 *      (or 環境変数 CAPACITOR_CONFIG_FILE で指定)
 *   2. `npx cap sync ios` → ios-uranyan/ に同期
 *   3. Xcode で ios-uranyan/App.xcworkspace を開き、Bundle ID / 表示名 / アイコン を確認
 *   4. App Store Connect の `jp.filmo.uranyan` エントリに submit
 *
 * 詳細手順: docs/uranyan-app.md
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.filmo.uranyan',
  appName: 'うらにゃん',
  webDir: 'out',
  server: {
    // ?app=uranyan を付けることで Web 側に「うらにゃん専用アプリで開いている」ことを通知。
    // standaloneApp.ts (useStandaloneApp) が検出してナビ等を切り替える。
    url: 'https://filmo.me/games/uranyan?app=uranyan',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 5000,
      // うらにゃんはピンク基調にしたいので Filmo のダークから変更。
      // 実際のスプラッシュ画像は ios-uranyan/App/App/Assets.xcassets で差し替え。
      backgroundColor: '#FF7AAE',
      launchFadeOutDuration: 300,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#FF7AAE',
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    // うらにゃんアプリのセーフエリア背景もピンクに揃える。
    backgroundColor: '#FF7AAE',
    contentInset: 'automatic',
    scrollEnabled: true,
    allowsLinkPreview: false,
  },
};

export default config;
