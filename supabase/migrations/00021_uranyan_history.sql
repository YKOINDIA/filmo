-- ============================================
-- うらにゃん。: 占い履歴 + レビュー (後日評価)
-- ============================================
-- ユーザーが「履歴に残す」した占い結果を保存する。
-- 期間 (例: 夏休み2026) を付けて占うと、その後日にレビューできる。
-- 管理画面では低評価の結果パターンを集計し、テンプレ品質改善に使う。
--
-- 履歴は決定論的に再現可能なので、本来は (user_id, target_birthdates, menu) だけで
-- 復元できる。それでも payload を保存する理由:
--   1) テンプレ改修後に「占った時の文言」が変わると、レビューが意味不明になる
--   2) 管理画面で過去の評価集計をするとき、当時のテンプレ文を見たい
-- スナップショットとして JSONB で持つ。

CREATE TABLE IF NOT EXISTS uranyan_readings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'life' = 天命トリセツ, 'compat' = 2人相性, 'group_compat' = 3+人グループ相性
  menu            TEXT NOT NULL CHECK (menu IN ('life','compat','group_compat')),
  -- 対象名 (スナップショット) と生年月日 (DATE)。
  -- life=1人, compat=2人, group_compat=3〜8人
  target_names    TEXT[] NOT NULL CHECK (
                    array_length(target_names, 1) BETWEEN 1 AND 8
                  ),
  target_birthdates DATE[] NOT NULL CHECK (
                    array_length(target_birthdates, 1) = array_length(target_names, 1)
                  ),
  -- 期間タグ (任意): 例 "夏休み2026" "テスト期間" "新学期"
  -- start/end が両方 NULL なら期間なし。end のみで「○月まで」も可。
  period_label    TEXT,
  period_start    DATE,
  period_end      DATE,
  -- 結果要約 (短い索引キー): 管理画面で同じパターンを集計するため
  --   life: "貫索×石門×鳳閣" (北×中央×東 主星)
  --   compat: "成"            (関係名)
  --   group_compat: "調和度:3.8/5"
  result_summary  TEXT NOT NULL,
  -- 結果スナップショット (フル JSON)
  result_payload  JSONB NOT NULL,
  -- ── 後日レビュー欄 ──────────────────────────
  rating          SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  review_text     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 自分の履歴: 新しい順
CREATE INDEX IF NOT EXISTS idx_uranyan_readings_user_created
  ON uranyan_readings (user_id, created_at DESC);

-- レビュー待ち (rating IS NULL): UI で「レビューしよう」誘導用。
-- 「期間終了済み or 24h 経過」の判定は app 側 (isReviewable) で行う。
-- インデックス式に COALESCE(..., created_at::DATE) を使うと
-- TIMESTAMPTZ→DATE 変換は STABLE なため IMMUTABLE 要求に違反する。
-- 単純に (user_id, period_end NULLS LAST, created_at DESC) で並べる。
CREATE INDEX IF NOT EXISTS idx_uranyan_readings_review_pending
  ON uranyan_readings (user_id, period_end NULLS LAST, created_at DESC)
  WHERE rating IS NULL;

-- 管理集計: 低評価のテンプレを早く引きたい
CREATE INDEX IF NOT EXISTS idx_uranyan_readings_low_rating
  ON uranyan_readings (menu, result_summary)
  WHERE rating IS NOT NULL AND rating <= 2;

-- ────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────
ALTER TABLE uranyan_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY uranyan_readings_select_own ON uranyan_readings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY uranyan_readings_insert_own ON uranyan_readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY uranyan_readings_update_own ON uranyan_readings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY uranyan_readings_delete_own ON uranyan_readings
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- 管理用 RPC: 低評価が多いテンプレパターンを集計
-- ────────────────────────────────────────────
-- SECURITY DEFINER で全行スキャンするが、認可は app 側 (isAdminEmail) に
-- 委ねる。GRANT も authenticated に限定し、無認証アクセスは禁ずる。
-- "(menu, result_summary)" ごとに集計し、サンプル件数 N>=3 かつ平均 <3.0 のみ返す。
CREATE OR REPLACE FUNCTION admin_uranyan_low_rated_summary(
  p_min_samples INTEGER DEFAULT 3,
  p_max_avg     NUMERIC DEFAULT 3.0
)
RETURNS TABLE (
  menu             TEXT,
  result_summary   TEXT,
  total_reviews    BIGINT,
  avg_rating       NUMERIC,
  low_count        BIGINT,
  latest_reviewed  TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    menu,
    result_summary,
    COUNT(*)::BIGINT                                       AS total_reviews,
    ROUND(AVG(rating)::NUMERIC, 2)                          AS avg_rating,
    COUNT(*) FILTER (WHERE rating <= 2)::BIGINT             AS low_count,
    MAX(reviewed_at)                                        AS latest_reviewed
  FROM uranyan_readings
  WHERE rating IS NOT NULL
  GROUP BY menu, result_summary
  HAVING COUNT(*) >= p_min_samples AND AVG(rating) < p_max_avg
  ORDER BY low_count DESC, avg_rating ASC, total_reviews DESC
$$;
GRANT EXECUTE ON FUNCTION admin_uranyan_low_rated_summary(INTEGER, NUMERIC) TO authenticated;

-- 詳細: 特定パターンの個別レビューを取り出す
CREATE OR REPLACE FUNCTION admin_uranyan_pattern_reviews(
  p_menu           TEXT,
  p_result_summary TEXT,
  p_limit          INTEGER DEFAULT 50
)
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  target_names    TEXT[],
  rating          SMALLINT,
  review_text     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  period_label    TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, user_id, target_names, rating, review_text, reviewed_at, created_at, period_label
  FROM uranyan_readings
  WHERE menu = p_menu AND result_summary = p_result_summary AND rating IS NOT NULL
  ORDER BY rating ASC, reviewed_at DESC
  LIMIT p_limit
$$;
GRANT EXECUTE ON FUNCTION admin_uranyan_pattern_reviews(TEXT, TEXT, INTEGER) TO authenticated;
