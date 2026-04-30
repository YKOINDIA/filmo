# GA4 セットアップガイド (Filmo)

`app/lib/analytics.ts` から送信される **カスタムディメンション + イベント** を GA4 ダッシュボードで使えるようにする手順。TaxiPro 側にも同じパターンで反映可能(用語が違うだけ)。

---

## 1. カスタムディメンションを登録

GA4 → **管理 (歯車) → カスタム定義 → カスタムディメンション → 「カスタムディメンションを作成」**

### 1A. ユーザー範囲(User-scoped)

ユーザー単位で1つの値を保持。「フランス語UI ユーザーの DAU」のような分析に使う。

| ディメンション名 | 範囲 | ユーザープロパティ | 値の例 |
|---|---|---|---|
| `app_locale` | ユーザー | `app_locale` | `ja` / `en` / `ko` / `zh` / `es` |
| `user_country` | ユーザー | `user_country` | ISO 2-letter (`JP`/`US`/...) |
| `user_authenticated` | ユーザー | `user_authenticated` | `true` / `false` |
| `user_level_bucket` | ユーザー | `user_level_bucket` | `1-3` / `4-7` / `8+` |
| `app_platform` | ユーザー | `app_platform` | `web` / `ios_capacitor` / `android_capacitor` |

### 1B. イベント範囲(Event-scoped)

イベントごとのパラメータ。「review_posted のうち is_draft=false の割合」「list_shared の channel 内訳」のような分析に使う。

| ディメンション名 | 範囲 | イベントパラメータ | 関連イベント |
|---|---|---|---|
| `from_lang` | イベント | `from_lang` | `language_changed`, `translate_clicked` |
| `to_lang` | イベント | `to_lang` | `language_changed`, `translate_clicked` |
| `share_channel` | イベント | `share_channel` | `list_shared`, `profile_shared` |
| `media_type` | イベント | `media_type` | `work_opened` |
| `source` | イベント | `source` | `work_opened` |
| `tab` | イベント | `tab` | `search_performed` |
| `is_draft` | イベント | `is_draft` | `review_posted` |
| `is_collaborative` | イベント | `is_collaborative` | `list_created` |
| `method` | イベント | `method` | `sign_up` |

> **24〜48時間後**にレポート(自由形式・探索)で選択肢に出てくる。すぐ確認したいなら **リアルタイム → ユーザープロパティ / イベント** で値が来てるか確認可能。
>
> カスタムディメンションは無料プランで **最大50個** (ユーザー範囲25個 + イベント範囲25個) まで登録可能。

---

## 2. キーイベントとしてマーク

GA4 → **管理 → イベント → 「キーイベントとしてマーク」** で以下をON:

| イベント | 重要度 | 意味 |
|---|---|---|
| `sign_up` | ★★★ | 新規登録(GA4 標準推奨イベント) |
| `review_posted` | ★★★ | レビュー投稿(コア活動の入口) |
| `list_created` | ★★ | リスト作成(エンゲージメント深化) |
| `list_forked` | ★★ | リストコピー(バイラル) |
| `list_shared` | ★ | リスト共有(バイラル) |
| `user_followed` | ★ | フォロー(ソーシャル) |

これでファネル(登録 → 初鑑賞 → 初レビュー)が GA4 標準の「経路」「目標到達」レポートで自動分析される。

---

## 3. 推奨レポート(自由形式)

### A. 言語別 DAU/MAU

| 設定 | 値 |
|---|---|
| 行 | `app_locale` |
| 値 | アクティブユーザー数, 新規ユーザー数, ユーザーあたりエンゲージ時間, エンゲージメント率 |

→ 5言語のうちどれが最もコア活動してるか分かる。

### B. プラットフォーム × 国 のクロス集計

| 設定 | 値 |
|---|---|
| 行 | `Country` |
| 列 | `app_platform` |
| 値 | アクティブユーザー数 |

→ 「日本のWebは多いが iOS は少ない」「韓国は iOS 比率が高い」等の地域差が見える。

### C. 機能別エンゲージメント

| 設定 | 値 |
|---|---|
| 行 | `Event name` (フィルタ: `review_posted`/`list_created`/`list_liked`/`work_opened`/`search_performed`) |
| 列 | `app_locale` |
| 値 | イベント数, ユーザーあたりイベント数 |

→ 言語別にどの機能が使われてるか。

### D. 翻訳機能の利用率

| 設定 | 値 |
|---|---|
| 行 | `from_lang` |
| 列 | `to_lang` |
| 値 | `translate_clicked` のイベント数 |

→ 「英語レビューが日本語に翻訳される」が一番多いか、逆もあるか。

### E. ファネル(探索 → ファネルデータ探索)

ステップ:
1. `session_start` (任意の最初のイベント)
2. `sign_up`
3. 初の `work_opened`
4. 初の `review_posted` または `list_created`

→ どこで脱落してるか、言語/国別のファネル比較。

---

## 4. オーディエンス(セグメント定義)

GA4 → **管理 → オーディエンス** で「コアユーザー」「離脱予備軍」等を定義。

### 例: 日本語コアユーザー

- 条件: `app_locale = ja` AND `user_level_bucket in [4-7, 8+]`
- 用途: このオーディエンス向け施策の効果測定

### 例: 海外英語ユーザー(獲得直後)

- 条件: `app_locale = en` AND `user_country != JP` AND first session within 7 days
- 用途: オンボーディング改善のターゲット

---

## 5. アラート(Custom Insights)

GA4 → **分析情報と最適化案 → カスタム インサイトを作成**(または **管理 → カスタム インサイト**)

### 自動検知(設定不要)

GA4 の ML が常時動いて異常を検出してくれる。**全部 ON で OK**(ノイズが多ければ後で調整)。

### Filmo 推奨の手動カスタムインサイト 5本

#### 1. DAU 異常検知(必須)
- **評価頻度**: 日次
- **指標**: `アクティブ ユーザー`
- **条件**: 前日比 **-30%以上** 低下
- **通知**: Email
- **目的**: サービス障害・SEO圏外落ち等の重大事故を早期発見

#### 2. 新規登録の急減(必須)
- **評価頻度**: 日次
- **指標**: `イベント数` フィルタ `event_name = sign_up`
- **条件**: 前週同曜日比 **-50%以上** 低下
- **通知**: Email
- **目的**: サインアップフローが壊れてないか / ASO・SEO の異変

#### 3. レビュー投稿の急減(コアエンゲージ先行指標)
- **評価頻度**: 週次
- **指標**: `イベント数` フィルタ `event_name = review_posted`
- **条件**: 前週比 **-30%以上** 低下
- **目的**: 離脱の前兆を捕まえる

#### 4. list_forked / list_liked の急増(バイラル検知)
- **評価頻度**: 日次
- **指標**: `イベント数` フィルタ `event_name = list_forked`
- **条件**: 前日比 **+200%以上** 増加
- **通知**: Email + Slack
- **目的**: バズったリストを検知して PR や X で乗っかる

#### 5. 新規国の流入急増(海外展開チャンス)
- **評価頻度**: 週次
- **セグメント**: 特定 `Country`(JP / US / KR 以外で 1つずつ)
- **指標**: `アクティブ ユーザー`
- **条件**: 前週 0 → **50 以上** に増加
- **目的**: 想定外の海外展開の兆しを察知してローカライズ判断

### Slack 通知の追加

GA4 → カスタム インサイト編集 → 通知 → **Slack Webhook URL** を貼る。
Slack workspace で先に Incoming Webhook を作成しておく必要あり(`https://api.slack.com/messaging/webhooks`)。

---

## 補足: BigQuery エクスポート(将来)

ユーザー数が 100万 を超えたら GA4 標準の探索ではサンプリングされる。**BigQuery エクスポート(無料)** を有効化すると raw event データが SQL で分析できる。GA4 → 管理 → BigQuery のリンク から接続。コスト感: 月100万イベントで $5 程度。
