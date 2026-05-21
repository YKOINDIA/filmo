# うらにゃん 単独 iOS アプリ — 配信運用ガイド

Filmo 本体の Capacitor 構成を流用し、**App Store 上は別エントリ** (`jp.filmo.uranyan` / 表示名「うらにゃん」) として配信するための運用メモ。

## ゴール

**ローカル Mac 不要・GitHub Actions だけで TestFlight / App Store までフル自動化** する。

## 設計概要

- **Web コンテンツは同じ** — `https://filmo.me` をそのまま WKWebView でホスト
- **エントリ URL を変える** — `https://filmo.me/games/uranyan?app=uranyan` で起動
- **`?app=uranyan` で UI 分岐** — [app/lib/standaloneApp.ts](../app/lib/standaloneApp.ts) の `useStandaloneApp()` が検出して:
  - `TopBar` の「← ホーム」を非表示 (menu phase がアプリのホーム)
  - 「ログイン」リンクを非リンクテキスト化 (Filmo Dashboard に飛ばさない)
- **アカウントは Filmo と完全共通** — 同じ Supabase。Filmo で登録済みのユーザーは同じ ID/PW でうらにゃんアプリにもログイン可能
- **iOS ディレクトリは別** — `ios/` (Filmo) と `ios-uranyan/` (うらにゃん) が並存

## 初期セットアップ (1 回だけ)

### ① Apple Developer Portal で App ID を登録

[Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list) →
- Identifier: `jp.filmo.uranyan`
- Description: `Uranyan`
- Capabilities: 最小限 (Push Notifications を使うなら追加)

### ② Provisioning Profile を作成

同 Portal → **Profiles** → **+** →
- Type: App Store
- App ID: `jp.filmo.uranyan`
- Certificates: Filmo と同じ Distribution 証明書を選択 (Team 共通)
- Name: `Uranyan App Store` (Fastfile の `URANYAN_PROFILE_NAME` と一致させる)

ダウンロードした `.mobileprovision` を base64 化して GitHub Secrets に登録:

```bash
base64 -i Uranyan_App_Store.mobileprovision | pbcopy
```

→ GitHub Repository → Settings → Secrets and variables → Actions → New repository secret →
- Name: `BUILD_PROVISION_PROFILE_URANYAN_BASE64`
- Value: (ペースト)

### ③ App Store Connect にアプリを登録

[App Store Connect](https://appstoreconnect.apple.com/) → My Apps → **+** → New App →
- Platform: iOS
- Name: **うらにゃん** (12 文字以内 / Apple 制限)
- Primary Language: Japanese
- Bundle ID: `jp.filmo.uranyan` (Apple Developer Portal で登録済みのものが選択肢に出る)
- SKU: `uranyan-001` (任意)

カテゴリ等の詳細は提出時に設定。

### ④ ios-uranyan/ ディレクトリを CI で生成

GitHub Actions → **iOS Init (うらにゃん)** → **Run workflow** を押す。

完了後、自動生成される PR `chore(uranyan): init ios-uranyan/ via CI` をマージ。

PR には:
- `ios-uranyan/App.xcworkspace` (Bundle ID: `jp.filmo.uranyan`、表示名: うらにゃん)
- Capacitor プラグイン sync 済み
- 不要な usage description (カメラ/写真) は削除済み

が含まれる。

## 通常リリース手順

### TestFlight (ベータ配信)

GitHub Actions → **iOS Build & TestFlight (うらにゃん)** → Run workflow → lane: `beta_uranyan`

完了するとビルドが TestFlight に上がる (処理待ち約 10〜30 分)。

### App Store 本番提出

同 workflow を `release_uranyan` lane で実行。
ビルドが App Store Connect に上がったあと、Web UI から **手動でレビューに提出** する (メタデータ・スクショ・プライバシーラベルを設定後)。

### タグでビルドトリガー

```bash
git tag uranyan-v1.0.0-ios
git push origin uranyan-v1.0.0-ios
```

→ 自動で `beta_uranyan` lane が実行される (Filmo 本体の `v*.*.*-ios` とは別タグ)。

## GitHub Secrets 一覧 (うらにゃん専用に追加するもの)

| Secret 名 | 値 | 用途 |
|---|---|---|
| `BUILD_PROVISION_PROFILE_URANYAN_BASE64` | `Uranyan App Store.mobileprovision` を base64 化したもの | うらにゃん専用署名 |

他 (`KEYCHAIN_PASSWORD` / `BUILD_CERTIFICATE_BASE64` / `P12_PASSWORD` / `APP_STORE_CONNECT_API_KEY_*`) は Filmo 本体と共有 (同一 Apple Team)。

## App Store Connect 設定

| 項目 | 値 |
|---|---|
| カテゴリ | **ライフスタイル** (占いは Lifestyle が主流。Entertainment より審査が緩い) |
| 価格 | 無料 |
| プライバシーラベル | Filmo 本体と同じ (Supabase 同居) |
| Apple 4.2 (Minimum Functionality) 対策 | 申請ノートに「独自占いロジック (相性計算・期間運勢・ファッション運勢・グループ相性、約 6,500 行のクライアントロジック) を本アプリ独自で実装。Capacitor は配信フレームワーク」と記載 |

### ASO キーワード候補
- 主: `占い` `相性` `相性診断` `性格診断`
- 副: `恋愛占い` `生年月日` `今日の運勢` `グループ` `友達` `カップル`

## 既知の制約・TODO

- **iOS ディレクトリが 2 つ並存** — `ios/` (Filmo) と `ios-uranyan/` (うらにゃん)。それぞれ独立した `App.xcworkspace`
- **外部リンクの Safari 起動** — スタンドアロンモードで Filmo 本体への内部リンクが発生した場合、`window.open(url, '_system')` で外部 Safari にルートする処理が将来必要 (現状うらにゃんページから Filmo 他画面への遷移は無いので未対応)
- **Universal Links** — `apple-app-site-association` は Filmo 本体だけ列挙し、うらにゃんは未使用 (URL 衝突回避)
- **アプリアイコン / スプラッシュ素材** — `ios-uranyan/App/App/Assets.xcassets/AppIcon.appiconset` をピンク基調のうらにゃんブランド画像で差し替える必要あり (workflow_dispatch の init では未着手)

## トラブルシューティング

### `iOS Init` workflow が "ios-uranyan/ already exists" で失敗
意図的に再生成したい場合は、ローカルで `ios-uranyan/` を削除してコミット → push してから再実行。

### `iOS Build` で `URANYAN_PROFILE_NAME` が見つからないエラー
Apple Developer Portal で Provisioning Profile の Name が Fastfile の `URANYAN_PROFILE_NAME` (= `Uranyan App Store`) と一致しているか確認。リネームしたら GitHub Secrets `BUILD_PROVISION_PROFILE_URANYAN_BASE64` も更新が必要。

### Apple 4.2 でリジェクト
申請ノート (前述) を強化し、スクショで「占いロジックが独自に動いている」ことが分かるように差し替える。
