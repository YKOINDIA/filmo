-- ============================================
-- FILMAPPY ミニゲーム (マッピーランド風アクション・シネマ泥棒)
-- ============================================
-- 1 プレイの最終結果 (スコア、到達ステージ、クリア有無、ノーミス有無、
-- 回収アイテム数、スタンさせた敵数) を保存し、ベストスコアの
-- リーダーボードと自分の戦績を集計する。
-- 既存ゲーム (emoji_quiz, crystal_blast, minesweeper, filmius) と
-- 同じ pattern:
--   - 自分のセッションは自分だけが読める (RLS)
--   - ポイント付与は app 側の addPoints() を経由 (日次キャップ共有)
--   - リーダーボードは public (anon でも閲覧可)
--
-- 注: 接続タイムアウトで途中まで適用されたケースに備え、全文 idempotent
--     (CREATE POLICY も DROP POLICY IF EXISTS で前置きしてから再作成) に
--     してある。安全に何度でも再実行できる。

-- ============================================
-- filmappy_sessions: 1 プレイの結果
-- ============================================
-- stage_reached: 死亡または途中離脱した時点のステージ (1..3)、全クリ時は 4
-- cleared: 最終ステージのアイテムを全回収したか
-- no_miss: 全行程ノーミス (ミス=自機ロスト) でクリアしたかどうか
CREATE TABLE IF NOT EXISTS filmappy_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score            INTEGER NOT NULL DEFAULT 0,
  stage_reached    SMALLINT NOT NULL DEFAULT 1,
  cleared          BOOLEAN NOT NULL DEFAULT FALSE,
  no_miss          BOOLEAN NOT NULL DEFAULT FALSE,
  items_collected  INTEGER NOT NULL DEFAULT 0,
  enemies_stunned  INTEGER NOT NULL DEFAULT 0,
  duration_ms      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_filmappy_sessions_user_created
  ON filmappy_sessions (user_id, created_at DESC);
-- リーダーボード用: 「ユーザーごとのベストスコア」スキャンを最適化
CREATE INDEX IF NOT EXISTS idx_filmappy_sessions_score
  ON filmappy_sessions (score DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE filmappy_sessions ENABLE ROW LEVEL SECURITY;

-- ポリシーは PostgreSQL 16 以下では CREATE POLICY IF NOT EXISTS が使えないので、
-- 一度 DROP してから CREATE することで再実行に対して安全にする。
DROP POLICY IF EXISTS filmappy_sessions_select_own ON filmappy_sessions;
CREATE POLICY filmappy_sessions_select_own ON filmappy_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS filmappy_sessions_insert_own ON filmappy_sessions;
CREATE POLICY filmappy_sessions_insert_own ON filmappy_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 自分の戦績 (ベストスコア、最高到達ステージ、累計プレイ数、クリア数)
-- ============================================
CREATE OR REPLACE FUNCTION get_filmappy_stats(p_user_id UUID)
RETURNS TABLE (
  best_score        INTEGER,
  max_stage_reached SMALLINT,
  total_plays       INTEGER,
  total_clears      INTEGER,
  no_miss_clears    INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(MAX(score), 0)::INTEGER                                    AS best_score,
    COALESCE(MAX(stage_reached), 1)::SMALLINT                           AS max_stage_reached,
    COUNT(*)::INTEGER                                                    AS total_plays,
    COUNT(*) FILTER (WHERE cleared = TRUE)::INTEGER                      AS total_clears,
    COUNT(*) FILTER (WHERE cleared = TRUE AND no_miss = TRUE)::INTEGER   AS no_miss_clears
  FROM filmappy_sessions
  WHERE user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_filmappy_stats(UUID) TO authenticated, anon;

-- ============================================
-- リーダーボード (ベストスコア TOP N)
-- ============================================
-- 同スコアの場合は「先に達成した」プレイヤーを上位に置く。
CREATE OR REPLACE FUNCTION get_filmappy_leaderboard(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id        UUID,
  user_name      TEXT,
  user_avatar    TEXT,
  best_score     INTEGER,
  stage_reached  SMALLINT,
  cleared        BOOLEAN,
  no_miss        BOOLEAN,
  achieved_at    TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH best_per_user AS (
    SELECT DISTINCT ON (user_id)
      user_id, score, stage_reached, cleared, no_miss, created_at
    FROM filmappy_sessions
    ORDER BY user_id, score DESC, created_at ASC
  )
  SELECT
    bpu.user_id,
    u.name              AS user_name,
    u.avatar_url        AS user_avatar,
    bpu.score           AS best_score,
    bpu.stage_reached,
    bpu.cleared,
    bpu.no_miss,
    bpu.created_at      AS achieved_at
  FROM best_per_user bpu
  JOIN users u ON u.id = bpu.user_id
  WHERE COALESCE(u.is_banned, FALSE) = FALSE
  ORDER BY bpu.score DESC, bpu.created_at ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_filmappy_leaderboard(INTEGER) TO authenticated, anon;
