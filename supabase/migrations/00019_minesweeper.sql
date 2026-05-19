-- ============================================
-- Minesweeper ミニゲーム
-- ============================================
-- 古典的マインスイーパ (爆弾を踏まずに全マス開ける) のセッション記録。
-- 既存ゲーム (emoji_quiz, crystal_blast) と同じ pattern で
--   - 自分のセッションは自分だけが読める
--   - ポイント付与は app 側の addPoints() を経由
--   - リーダーボードは public (anon でも閲覧可)
-- とする。
--
-- 難易度ごとにベストタイムを集計するのが目的なので、won/time_ms/difficulty
-- にインデックスを張る。

-- ============================================
-- minesweeper_sessions: 1 プレイの結果
-- ============================================
CREATE TABLE IF NOT EXISTS minesweeper_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  difficulty      TEXT NOT NULL CHECK (difficulty IN ('easy','normal','hard')),
  won             BOOLEAN NOT NULL,
  time_ms         INTEGER NOT NULL DEFAULT 0,
  cells_revealed  INTEGER NOT NULL DEFAULT 0,
  flags_placed    INTEGER NOT NULL DEFAULT 0,
  board_w         SMALLINT NOT NULL DEFAULT 0,
  board_h         SMALLINT NOT NULL DEFAULT 0,
  mines_count     SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minesweeper_sessions_user_created
  ON minesweeper_sessions (user_id, created_at DESC);
-- リーダーボード用: 「勝利かつ難易度別の最速タイム」のスキャンを最適化
CREATE INDEX IF NOT EXISTS idx_minesweeper_sessions_best_time
  ON minesweeper_sessions (difficulty, time_ms ASC)
  WHERE won = TRUE;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE minesweeper_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY minesweeper_sessions_select_own ON minesweeper_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY minesweeper_sessions_insert_own ON minesweeper_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 自分の難易度別ベストタイム
-- ============================================
CREATE OR REPLACE FUNCTION get_minesweeper_stats(p_user_id UUID)
RETURNS TABLE (
  difficulty   TEXT,
  best_time_ms INTEGER,
  wins         INTEGER,
  total_plays  INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    difficulty,
    MIN(time_ms) FILTER (WHERE won = TRUE)::INTEGER     AS best_time_ms,
    COUNT(*) FILTER (WHERE won = TRUE)::INTEGER         AS wins,
    COUNT(*)::INTEGER                                    AS total_plays
  FROM minesweeper_sessions
  WHERE user_id = p_user_id
  GROUP BY difficulty;
$$;

GRANT EXECUTE ON FUNCTION get_minesweeper_stats(UUID) TO authenticated, anon;

-- ============================================
-- リーダーボード (難易度別の最速タイム TOP N)
-- ============================================
CREATE OR REPLACE FUNCTION get_minesweeper_leaderboard(
  p_difficulty TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  user_id      UUID,
  user_name    TEXT,
  user_avatar  TEXT,
  best_time_ms INTEGER,
  achieved_at  TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH best_per_user AS (
    SELECT DISTINCT ON (user_id)
      user_id, time_ms, created_at
    FROM minesweeper_sessions
    WHERE difficulty = p_difficulty
      AND won = TRUE
    ORDER BY user_id, time_ms ASC, created_at ASC
  )
  SELECT
    bpu.user_id,
    u.name        AS user_name,
    u.avatar_url  AS user_avatar,
    bpu.time_ms   AS best_time_ms,
    bpu.created_at AS achieved_at
  FROM best_per_user bpu
  JOIN users u ON u.id = bpu.user_id
  WHERE COALESCE(u.is_banned, FALSE) = FALSE
  ORDER BY bpu.time_ms ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_minesweeper_leaderboard(TEXT, INTEGER) TO authenticated, anon;
