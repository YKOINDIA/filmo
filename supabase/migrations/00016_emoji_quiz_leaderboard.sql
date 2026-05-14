-- ============================================
-- 絵文字クイズ リーダーボード RPC
-- ============================================
-- emoji_quiz_sessions は RLS で本人のみ参照可なので、リーダーボードを
-- 表示するには SECURITY DEFINER の RPC で「ベストスコア + 公開可能な
-- ユーザー情報のみ」を返す形にする。
--
-- 仕様:
--   - 各ユーザーのベストスコア (同点なら所要時間が短い方) を 1 行にする
--   - 上位 p_limit 件を score DESC, total_time_ms ASC で返す
--   - 凍結 (is_banned) ユーザーは除外
--   - 認証済み / 匿名どちらからも実行可能 (順位表は公開情報)

CREATE OR REPLACE FUNCTION get_emoji_quiz_leaderboard(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id        UUID,
  user_name      TEXT,
  user_avatar    TEXT,
  best_score     INTEGER,
  total_time_ms  INTEGER,
  achieved_at    TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH best_per_user AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      score,
      total_time_ms,
      created_at
    FROM emoji_quiz_sessions
    ORDER BY user_id, score DESC, total_time_ms ASC
  )
  SELECT
    bpu.user_id,
    u.name AS user_name,
    u.avatar_url AS user_avatar,
    bpu.score AS best_score,
    bpu.total_time_ms,
    bpu.created_at AS achieved_at
  FROM best_per_user bpu
  JOIN users u ON u.id = bpu.user_id
  WHERE COALESCE(u.is_banned, FALSE) = FALSE
  ORDER BY bpu.score DESC, bpu.total_time_ms ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_emoji_quiz_leaderboard(INTEGER) TO authenticated, anon;
