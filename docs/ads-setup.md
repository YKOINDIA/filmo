# 広告マネタイズ セットアップガイド

目標: **月間広告売上 100 万円**。実装はコード側が完了済みで、このドキュメントは
「アカウント設定 → 環境変数 → リリース」の運用手順と収益設計をまとめる。

## 全体像

| プラットフォーム | ネットワーク | 実装 |
|---|---|---|
| iOS/Android アプリ (Capacitor) | **AdMob** | `@capacitor-community/admob` プラグイン。バナー + インタースティシャル |
| Web ブラウザ (filmo.me) | **AdSense** | Auto ads (スクリプト注入のみ。配置は Google が自動最適化) |

主要ファイル:

- `app/lib/ads.ts` — 広告ロジック本体 (プラットフォーム判定 / 同意フロー / 頻度制御)
- `app/components/AdsInit.tsx` — layout 常駐。初期化とバナーの出し分け
- `app/components/GameShareButtons.tsx` — ゲーム結果画面 = インタースティシャルのトリガー
- `public/ads.txt`, `public/app-ads.txt` — パブリッシャー ID (pub-1988566884852514) を静的配信
- `ios/App/App/Info.plist` — AdMob App ID / ATT / SKAdNetwork

ポリシー上の絶対ルール (コードで強制済み):

- **WebView (Capacitor) 内で AdSense を出さない** — Google ポリシー違反でアカウント停止リスク
- **うらにゃん単独アプリ (`?app=uranyan`) には広告を出さない** — App Store 4.3(b) 再審査中

## 表示ポリシー (現在の設定)

| 広告 | 場所 | 制御 |
|---|---|---|
| バナー (アダプティブ) | `/` (メインタブ全体) と `/games` ハブのタブバー上 | 常時 |
| インタースティシャル | ミニゲームの結果画面 | 3 分間隔 / 1 日 8 回まで / 初回起動から 24h は非表示 |
| AdSense Auto ads | Web 全ページ | Google 自動配置 |

調整は `app/lib/ads.ts` 冒頭の定数 (`INTERSTITIAL_MIN_INTERVAL_MS` など) と
`AdsInit.tsx` の `BANNER_ROUTES` で行う。

## セットアップ手順

### 1. AdMob (アプリ内広告)

1. [AdMob コンソール](https://apps.admob.com/) で Google アカウント (AdSense と同じ推奨) にてパブリッシャー登録
2. アプリを追加: 「Filmo - 映画ノート」(jp.filmo.app, App Store 掲載済みを選択)
3. 広告ユニットを作成:
   - バナー → `NEXT_PUBLIC_ADMOB_BANNER_IOS`
   - インタースティシャル → `NEXT_PUBLIC_ADMOB_INTERSTITIAL_IOS`
   - (Android リリース時に同様に `_ANDROID` を作成)
4. **App ID の差し替え**: `ios/App/App/Info.plist` の `GADApplicationIdentifier` を
   テスト ID から本番 App ID (`ca-app-pub-xxxx~yyyy`) に変更 ← **忘れると本番で広告が出ない**
5. **app-ads.txt**: `public/app-ads.txt` に記載済み (pub-1988566884852514)。
   デプロイ後 https://filmo.me/app-ads.txt で配信されることを確認 → AdMob コンソールの
   「アプリ > すべてのアプリ > app-ads.txt」で「確認」を実行 (クロール反映に最大 24h)。
   ⚠️ AdMob は **App Store 掲載ページの「デベロッパー Web サイト」のドメイン** を見に行く。
   App Store Connect のマーケティング URL が https://filmo.me になっているか確認すること
6. App Store Connect:
   - 「アプリのプライバシー」を更新: トラッキング「はい」、広告データの収集を申告
   - ATT ダイアログ文言は Info.plist 設定済み (審査向けに自然な日本語)
7. ビルド (Mac):
   ```bash
   npm install            # @capacitor-community/admob が入る
   npm run cap:build:ios  # cap sync ios (Pod インストール込み)
   npm run cap:ios        # Xcode で実機確認 → アーカイブ
   ```
   実機確認時は env 未設定のままで OK (Google 公式テスト広告が表示される)。

### 2. AdSense (Web)

1. [AdSense](https://adsense.google.com/) で filmo.me を申請 (審査 1〜2 週間。
   公開コンテンツが多いので通る見込みは高いが、落ちたら指摘内容を修正して再申請)
2. 承認後、AdSense 管理画面で **Auto ads を ON** (フォーマットはアンカー + インフィード推奨、
   ページ内広告の密度は「低」から開始)
3. Vercel に `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-1988566884852514` を設定してデプロイ
   (ads.txt は `public/ads.txt` で配信済み)

### 3. 環境変数まとめ (Vercel: Production / Preview)

```
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-1988566884852514   # Web AdSense (未設定なら Web 広告オフ)
NEXT_PUBLIC_ADMOB_BANNER_IOS=ca-app-pub-1988566884852514/nnnnnnnnnn
NEXT_PUBLIC_ADMOB_INTERSTITIAL_IOS=ca-app-pub-1988566884852514/nnnnnnnnnn
NEXT_PUBLIC_ADMOB_BANNER_ANDROID=                     # Android リリース時
NEXT_PUBLIC_ADMOB_INTERSTITIAL_ANDROID=
```

ユニット ID が未設定の間は **自動的に Google テスト広告** になる
(収益ゼロだが安全。本番 ID を入れた瞬間から収益化開始)。

⚠️ ネイティブアプリは `server.url=https://filmo.me` で本番サイトを読むため、
env は **Vercel のデプロイに焼き込まれてからアプリに反映**される。
アプリの再リリースは不要 (Info.plist の App ID 差し替えだけはバイナリ更新が必要)。

## 収益試算 (月 100 万円への道)

日本の参考 eCPM: バナー ¥30〜80、インタースティシャル ¥400〜1,200、AdSense ¥100〜400 (RPM)。

| 規模 | DAU | バナー imp/日 (5/人) | インタースティシャル imp/日 (0.5/人) | 月売上目安 |
|---|---|---|---|---|
| 現状ベース | 1,000 | 5,000 (¥250) | 500 (¥350) | 約 ¥2 万 |
| 中間目標 | 10,000 | 50,000 (¥2,500) | 5,000 (¥3,500) | 約 ¥20 万 |
| **目標** | **50,000** | 250,000 (¥12,500) | 25,000 (¥17,500) | **約 ¥100 万** |

- 月 100 万円には **DAU 5 万 (MAU 20〜30 万)** が必要。広告の実装だけでは届かず、
  ユーザー成長 (SEO / シェア / リテンション) とセットで動かすこと
- 成長前の段階でも「広告がすでに回っている」状態を作っておくのが本ガイドの目的
  (ユーザーが増えた時に収益が自動でスケールする)
- インタースティシャルの頻度を上げれば短期売上は伸びるがリテンションを毀損する。
  変更時は GA4 の `ad_interstitial_shown` イベントと継続率を必ずセットで見る

## 計測

GA4 に以下のイベントが飛ぶ (`app/lib/analytics.ts` の `track()` 経由):

- `ad_banner_shown` — バナー表示
- `ad_interstitial_shown` — インタースティシャル表示 (`trigger` パラメータ付き)

AdMob / AdSense の管理画面の収益レポートと突き合わせて eCPM を監視する。

## 今後の拡張候補 (優先順)

1. **リワード広告**: ゲームのコンティニュー/ヒントと交換 (eCPM 最高、UX 毀損最小)
2. **Android リリース**: AdMob ユニット追加 + `android/` プロジェクト生成
3. **公開ページへの AdSense 手動ユニット**: 映画詳細 (`PublicWorkView`) のあらすじ下など
   SEO 流入ページに in-article 広告 (Auto ads の成績を見てから判断)
4. **プレミアム (広告非表示) サブスク**: 広告収益が安定したら検討
