# iOS リリース運用マニュアル

Filmo を GitHub Actions 経由でビルドし、TestFlight / App Store に配信するための手順書。

## 全体像

```
[開発者 Windows PC]            [MacBook (初回のみ)]                    [GitHub Actions macos-15]
  コード編集                      証明書 .p12 作成                        ↓
  git push ──────────────────→  Apple Developer で Profile 作成  ──→  Fastlane beta
                                Secrets に登録                         → Archive + TestFlight Upload
```

MacBook は **初回の証明書作成時だけ必要**。以降は GitHub Actions ですべて自動化。

> TaxiPro と同じ Apple Developer アカウント (Team ID `3VWJQ5D3L9`) で運用。
> Distribution 証明書は **TaxiPro 用と同じ `.p12` を流用可能**。Filmo 用には Provisioning Profile だけ新規作成する。

---

## 1. 初回セットアップ (一度だけ)

### 1.1 Apple Developer サイトでの作業

1. [Apple Developer](https://developer.apple.com/account) にログイン
2. **Identifiers** → `+` → App IDs → App
   - Bundle ID: `jp.filmo.app` (Explicit)
   - Capabilities: Push Notifications (使う場合)
3. **Devices**: TestFlight なら不要(社内 Ad Hoc 配信時のみ)
4. **Profiles** → `+` → **App Store** distribution
   - App ID: `jp.filmo.app`
   - Certificate: TaxiPro 用と同じ Apple Distribution 証明書を選択
   - Profile 名: `Filmo App Store` (※ `ExportOptions.plist` と一致必須)
   - ダウンロード → `Filmo_App_Store.mobileprovision`

### 1.2 証明書 `.p12` の用意

TaxiPro 用に作成した `TaxiPro_Distribution.p12` がそのまま使える(同一 Team ID 内では Distribution 証明書は 1 枚で複数アプリに使える)。

新規に作る場合は Mac + Keychain Access が必要。手順は TaxiPro の `docs/ios-release.md` § 1.2 を参照。

### 1.3 App Store Connect API Key

TaxiPro でセットアップ済みの API Key を**そのまま流用可能**(同じ Apple Developer アカウント内のすべてのアプリにアクセスできる)。

新規発行する場合:
1. [App Store Connect](https://appstoreconnect.apple.com/access/integrations/api) → **Users and Access** → **Integrations** → **App Store Connect API**
2. `+` で新規 Key
   - Name: `Filmo CI`
   - Access: **App Manager**
3. 生成されたら Issuer ID / Key ID / `AuthKey_XXXXXXXXXX.p8` を保管(p8 は一度しか DL できない)

### 1.4 App Store Connect でアプリ登録

1. My Apps → `+` → New App
   - Platform: iOS
   - Name: Filmo
   - Primary Language: Japanese
   - Bundle ID: `jp.filmo.app`(1.1 で登録したもの)
   - SKU: `filmo-ios-001`(任意)

---

## 2. GitHub Secrets 登録

リポジトリ `Settings` → `Secrets and variables` → `Actions`

### 2.1 証明書関連

| Secret 名 | 値 |
|---|---|
| `BUILD_CERTIFICATE_BASE64` | TaxiPro と同じ `.p12` を base64 化(流用可) |
| `P12_PASSWORD` | `.p12` エクスポート時のパスワード(TaxiPro と同じ) |
| `BUILD_PROVISION_PROFILE_BASE64` | **Filmo 用の `.mobileprovision` を base64 化**(これだけ新規) |
| `KEYCHAIN_PASSWORD` | 任意の強いランダム文字列(TaxiPro と同じ値で OK) |

base64 化:
- Mac: `base64 -i Filmo_App_Store.mobileprovision | pbcopy`
- PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("Filmo_App_Store.mobileprovision")) | Set-Clipboard`

### 2.2 App Store Connect API Key 関連

| Secret 名 | 値 |
|---|---|
| `APP_STORE_CONNECT_API_KEY_ID` | TaxiPro と同じ |
| `APP_STORE_CONNECT_API_ISSUER_ID` | TaxiPro と同じ |
| `APP_STORE_CONNECT_API_KEY_BASE64` | TaxiPro と同じ(`.p8` を base64 化したもの) |

### 2.3 Secrets チェックリスト

- [ ] `BUILD_CERTIFICATE_BASE64`(TaxiPro 流用)
- [ ] `P12_PASSWORD`(TaxiPro 流用)
- [ ] `BUILD_PROVISION_PROFILE_BASE64`(**Filmo 専用**)
- [ ] `KEYCHAIN_PASSWORD`(任意)
- [ ] `APP_STORE_CONNECT_API_KEY_ID`(TaxiPro 流用)
- [ ] `APP_STORE_CONNECT_API_ISSUER_ID`(TaxiPro 流用)
- [ ] `APP_STORE_CONNECT_API_KEY_BASE64`(TaxiPro 流用)

---

## 3. ビルド & 配信

### 3.1 TestFlight へ配信(日常運用)

1. GitHub → `Actions` → **iOS Build & TestFlight** ワークフロー
2. `Run workflow` → lane `beta` → Run
3. 20 分前後で完了。App Store Connect → TestFlight タブに新しいビルドが表示される
4. ビルドが "Processing" → "Ready to Submit" になったら内部テスター配布可能

### 3.2 App Store 本番リリース

1. TestFlight で十分にテスト済みであることを確認
2. `Run workflow` → lane `release` → Run
3. App Store Connect → 該当バージョンのページで:
   - スクリーンショット
   - 説明文
   - プライバシー情報
   - 審査メモ
4. **Submit for Review** を手動クリック

### 3.3 タグ push による自動化

バージョンタグ形式: `vX.Y.Z-ios`

```bash
git tag v1.0.0-ios
git push origin v1.0.0-ios
```

→ 自動で `beta` lane (TestFlight) が走る。

---

## 4. トラブルシューティング

### "No signing certificate found"
- `BUILD_CERTIFICATE_BASE64` を再エンコードして再登録
- `.p12` のパスワードが合っているか確認

### "Provisioning profile doesn't match"
- Profile 名が `ExportOptions.plist` の `Filmo App Store` と一致しているか
- Profile の Bundle ID が `jp.filmo.app` であるか
- Profile の署名証明書が `.p12` と同じものか

### "App Store Connect API authentication failed"
- Issuer ID / Key ID のタイプミス
- `.p8` ファイルに改行が混入していないか(base64 エンコード時)
- Key の権限が **App Manager** 以上か

### macOS runner の無料枠が足りない
- Private リポジトリは macOS 時間が 10 倍換算
- GitHub Pro ($4/月) にアップグレードで 3,000 分に拡張
- 開発中は頻繁に回さず、リリース直前のみ実行

---

## 5. ファイル一覧(このセットアップで追加)

| パス | 役割 |
|---|---|
| `fastlane/Appfile` | Bundle ID / Apple ID / Team ID |
| `fastlane/Fastfile` | ビルド & 配信レーン定義 |
| `ios/App/ExportOptions.plist` | IPA エクスポート設定 |
| `.github/workflows/ios-build.yml` | CI ワークフロー |
| `Gemfile` | Fastlane / CocoaPods の Ruby 依存宣言 |
| `.gitignore` | iOS 署名ファイルの除外 |
| `docs/ios-release.md` | この手順書 |
