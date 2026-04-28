import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'jp.filmo.app',
  appName: 'Filmo',
  webDir: 'out',
  server: {
    url: 'https://filmo.me',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      // launchAutoHide: false — 自前で SplashScreen.hide() を呼んで隠す。
      // 自動 hide だと WebView 読み込み中に splash が消えて真っ暗な画面が見えるため。
      launchAutoHide: false,
      // 万が一プログラムから hide() が呼ばれない事故に備えて長めの最大値を設定。
      // (5秒で見切りをつける)
      launchShowDuration: 5000,
      backgroundColor: '#0a0b14',
      // フェードアウトでガクッと消える違和感をなくす
      launchFadeOutDuration: 300,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0a0b14',
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    // WebView がセーフエリア分インセットされるため、背景にアプリのダークカラーを指定。
    // 指定が無いとノッチ下やホームインジケーター付近が iOS のデフォルト白で表示されてしまう。
    backgroundColor: '#0a0b14',
    contentInset: 'automatic',
    scrollEnabled: true,
    allowsLinkPreview: false,
  },
};

export default config;
