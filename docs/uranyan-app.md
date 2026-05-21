# うらにゃん 単独 iOS アプリのビルド・リリース手順

Filmo 本体の Capacitor 構成を流用しつつ、`appId: jp.filmo.uranyan` / `appName: うらにゃん` で **App Store 上は別エントリ** として配信するための運用メモ。

## 設計概要

- **Web コンテンツは同じ** — `https://filmo.me` をそのまま WKWebView でホスト
- **エントリ URL を変える** — `https://filmo.me/games/uranyan?app=uranyan` で起動
- **`?app=uranyan` で UI 分岐** — [app/lib/standaloneApp.ts](../app/lib/standaloneApp.ts) の `useStandaloneApp()` フックが URL クエリを検出し、localStorage に永続化する。検出時は:
  - `TopBar` の「← ホーム」リンクを非表示 (`uranyan` の menu phase がアプリのホームになる)
  - 「ログイン」リンクを非リンクのテキストに変換 (Filmo Dashboard に飛ばさないため)
- **アカウントは Filmo と完全共通** — 同じ Supabase プロジェクトを使うため、Filmo で登録済みのユーザーは同じ ID/PW でうらにゃんアプリにもログイン可能。

## 初回セットアップ手順 (まだ ios-uranyan/ が無い段階)

### 1. Capacitor 設定を切り替えて sync

```bash
# 一時的に capacitor.config.ts を退避し、うらにゃん用設定で sync する
mv capacitor.config.ts capacitor.config.ts.bak
cp capacitor.uranyan.config.ts capacitor.config.ts
npm run build           # webDir 用の Next.js ビルド (out/)
npm run cap:sync:uranyan  # iOS / Android ディレクトリに sync
```

`npx cap add ios` でまだ iOS プロジェクトを作っていない場合は、

```bash
npx cap add ios
# 生成された ios/ を ios-uranyan/ にリネーム (Filmo 本体の ios/ と衝突回避)
mv ios ios-uranyan
```

### 2. Xcode で表示名・Bundle ID を確認

```bash
open ios-uranyan/App.xcworkspace
```

Xcode で:
- Target **App** → **General** → **Identity**
  - Display Name: `うらにゃん`
  - Bundle Identifier: `jp.filmo.uranyan`
- Target **App** → **General** → **App Icons and Launch Screen**
  - App Icon Source: 専用アイコン (`Assets.xcassets/AppIcon.appiconset`) を差し替え
  - Launch Screen: `LaunchScreen.storyboard` のロゴを差し替え

### 3. Info.plist (ios-uranyan/App/App/Info.plist)

- `CFBundleDisplayName` → `うらにゃん`
- カメラ/写真関連の `NSCameraUsageDescription` 等はうらにゃんでは不要なら削除 OK
  (App Store 審査で「使ってないなら消せ」と言われがち)

### 4. 設定ファイルを元に戻す

sync が終わったら、

```bash
rm capacitor.config.ts
mv capacitor.config.ts.bak capacitor.config.ts
```

(Filmo 本体の sync を間違って実行しないように)

## 通常リリース時の流れ

```bash
# Filmo 本体のリリース
npm run build && npm run cap:sync && npm run cap:ios

# うらにゃんアプリのリリース
mv capacitor.config.ts capacitor.config.ts.bak
cp capacitor.uranyan.config.ts capacitor.config.ts
npm run build
CAPACITOR_CONFIG_FILE=capacitor.uranyan.config.ts npx cap sync ios   # ios-uranyan/ に sync
rm capacitor.config.ts
mv capacitor.config.ts.bak capacitor.config.ts
open ios-uranyan/App.xcworkspace                                       # Xcode で archive → App Store Connect
```

> **TODO**: 手作業を減らすため、`scripts/build-uranyan.sh` で自動化したい。Phase 2 で対応。

## App Store Connect 設定

### 新規アプリ登録
- バンドル ID: `jp.filmo.uranyan` (Apple Developer Portal で先に登録)
- 名前: **うらにゃん** (12 文字以内 / Apple 制限)
- プライマリ言語: 日本語
- カテゴリ: **ライフスタイル** (占いは Lifestyle が主流。Entertainment より審査が緩い)
- 価格: 無料

### Apple 4.2 (Minimum Functionality) 対策
- 申請ノートに以下を記載:
  > このアプリは独自の占いロジック (相性計算・期間運勢・ファッション運勢・グループ相性、合計約 6,500 行のクライアントロジック) を提供します。Capacitor は配信フレームワークとして利用しており、コンテンツ自体は本アプリ独自のものです。
- スクリーンショット: メニュー / 個別占い / 結果カード / 履歴 など 6 枚以上
- プライバシーラベル: Filmo 本体と同じ設定 (Supabase 同居)

### ASO キーワード候補
- 主: `占い` `相性` `相性診断` `性格診断`
- 副: `恋愛占い` `生年月日` `今日の運勢` `グループ` `友達` `カップル`

## 既知の制約

- **iOS App ディレクトリが 2 つ並存する**: `ios/` (Filmo 本体) と `ios-uranyan/` (うらにゃん)。
  - `.gitignore` に `ios-uranyan/App/Pods/` を追加するなどの整理が必要。
- **Filmo 本体への遷移は完全に塞がない**: 例えば占い結果から作品リンクへの遷移は将来発生しうる。スタンドアロンモードでは `<a target="_blank">` で外部 Safari 起動が望ましい (今は未対応)。
- **Universal Links** で Filmo と URL 衝突しないように、うらにゃんアプリは Universal Links を使わない方針 (`apple-app-site-association` には Filmo のみ列挙)。
