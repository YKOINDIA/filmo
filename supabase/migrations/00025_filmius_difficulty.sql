-- ============================================
-- FILMIUS 難易度モード追加 (easy / normal / hard)
-- ============================================
-- filmius_sessions に difficulty カラムを追加し、
-- 自分の戦績 / リーダーボード RPC を難易度別で集計するよう拡張する。
--
-- 既存セッションは all 'normal' 扱い (DEFAULT)。
-- リーダーボード RPC は p_difficulty 引数で 1 難易度に絞り込む。

-- ============================================
-- スキーマ拡張
-- ============================================
ALTER TABLE filmius_sessions
  ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'normal'
    CHECK (difficulty IN ('easy','normal','hard'));

-- リーダーボード用: 難易度別ベストスコアのスキャンを最適化
CREATE INDEX IF NOT EXISTS idx_filmius_sessions_difficulty_score
  ON filmius_sessions (difficulty, score DESC);

-- 既存の idx_filmius_sessions_score は (全難易度合算) 用に残すが、
-- 主用途は新しい difficulty 込みインデックスに移る。

-- ============================================
-- 戦績 RPC を難易度別集計に置き換え
-- ============================================
-- 戻り値に difficulty を含める。p_user_id の全 difficulty 行を 1 行ずつ返す。
DROP FUNCTION IF EXISTS get_filmius_stats(UUID);

CREATE OR REPLACE FUNCTION get_filmius_stats(p_user_id UUID)
RETURNS TABLE (
  difficulty        TEXT,
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
    difficulty,
    COALESCE(MAX(score), 0)::INTEGER                                    AS best_score,
    COALESCE(MAX(stage_reached), 1)::SMALLINT                           AS max_stage_reached,
    COUNT(*)::INTEGER                                                    AS total_plays,
    COUNT(*) FILTER (WHERE cleared = TRUE)::INTEGER                      AS total_clears,
    COUNT(*) FILTER (WHERE cleared = TRUE AND no_miss = TRUE)::INTEGER   AS no_miss_clears
  FROM filmius_sessions
  WHERE user_id = p_user_id
  GROUP BY difficulty;
$$;

GRANT EXECUTE ON FUNCTION get_filmius_stats(UUID) TO authenticated, anon;

-- ============================================
-- リーダーボード RPC: 難易度別 TOP N
-- ============================================
DROP FUNCTION IF EXISTS get_filmius_leaderboard(INTEGER);

CREATE OR REPLACE FUNCTION get_filmius_leaderboard(
  p_difficulty TEXT DEFAULT 'normal',
  p_limit INTEGER DEFAULT 20
)
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
    FROM filmius_sessions
    WHERE difficulty = p_difficulty
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

GRANT EXECUTE ON FUNCTION get_filmius_leaderboard(TEXT, INTEGER) TO authenticated, anon;
