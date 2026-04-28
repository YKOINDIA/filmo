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
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a0b14',
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
