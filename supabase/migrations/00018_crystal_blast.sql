-- ============================================
-- CRYSTAL BLAST ミニゲーム (ぷよぷよ系 + 対戦)
-- ============================================
-- ソロモードのスコア集計と、ユーザー同士のオンライン対戦結果を保存する。
-- リアルタイム同期自体は Supabase Realtime (broadcast/presence) で行うので、
-- ここに保存するのは「対戦の最終結果」と「マッチメイキング待機列」のみ。

-- ============================================
-- crystal_blast_solo_sessions: ソロモードの 1 プレイ結果
-- ============================================
CREATE TABLE IF NOT EXISTS crystal_blast_solo_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL DEFAULT 0,
  max_chain       SMALLINT NOT NULL DEFAULT 0,
  total_pops      INTEGER NOT NULL DEFAULT 0,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crystal_blast_solo_user_created
  ON crystal_blast_solo_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crystal_blast_solo_score
  ON crystal_blast_solo_sessions (score DESC);

-- ============================================
-- crystal_blast_matches: 対戦結果 (どちらか勝者が決まった時点で挿入)
-- ============================================
CREATE TABLE IF NOT EXISTS crystal_blast_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code       TEXT,
  mode            TEXT NOT NULL CHECK (mode IN ('room', 'random')),
  player1_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player2_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  player1_score   INTEGER NOT NULL DEFAULT 0,
  player2_score   INTEGER NOT NULL DEFAULT 0,
  player1_chain   SMALLINT NOT NULL DEFAULT 0,
  player2_chain   SMALLINT NOT NULL DEFAULT 0,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crystal_blast_matches_p1_created
  ON crystal_blast_matches (player1_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crystal_blast_matches_p2_created
  ON crystal_blast_matches (player2_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crystal_blast_matches_winner
  ON crystal_blast_matches (winner_id, created_at DESC);

-- ============================================
-- crystal_blast_queue: ランダムマッチメイキング待機列
-- ============================================
-- 「待機列に入る → 既存待機者を探す → マッチ成立で両者の row を削除し共通 room_code を返す」
-- というフローのために使う。古い行を 5 分超で自動的に無効化するため、用途が短い行のみ保存される。
CREATE TABLE IF NOT EXISTS crystal_blast_queue (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  room_code       TEXT,
  matched_with    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crystal_blast_queue_created
  ON crystal_blast_queue (created_at)
  WHERE matched_with IS NULL;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE crystal_blast_solo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crystal_blast_matches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crystal_blast_queue         ENABLE ROW LEVEL SECURITY;

-- ソロ: 自分の記録のみ読み書き
CREATE POLICY crystal_blast_solo_select_own ON crystal_blast_solo_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY crystal_blast_solo_insert_own ON crystal_blast_solo_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 対戦記録: 当事者なら読める。書込みは当事者のみ (どちらかが結果を確定送信する)
CREATE POLICY crystal_blast_matches_select_participant ON crystal_blast_matches
  FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);
CREATE POLICY crystal_blast_matches_insert_participant ON crystal_blast_matches
  FOR INSERT WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

-- 待機列: 自分の行のみ操作可。ただし「他人とマッチ済み」かどうかを確認するため SELECT は広めに許可
CREATE POLICY crystal_blast_queue_select_all ON crystal_blast_queue
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY crystal_blast_queue_insert_own ON crystal_blast_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY crystal_blast_queue_update_participant ON crystal_blast_queue
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = matched_with);
CREATE POLICY crystal_blast_queue_delete_own ON crystal_blast_queue
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = matched_with);

-- ============================================
-- マッチメイキング RPC
-- ============================================
-- 自分を待機列に登録 → 既存待機者がいれば両者をマッチ済みにして room_code を返す。
-- 古い (5 分超) 待機行は同時に掃除する。
CREATE OR REPLACE FUNCTION crystal_blast_join_queue()
RETURNS TABLE (
  status      TEXT,
  room_code   TEXT,
  opponent_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_opponent  UUID;
  v_room      TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'unauthorized'::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- 古い待機行を掃除 (5 分以上経過したマッチ未成立)
  DELETE FROM crystal_blast_queue
   WHERE matched_with IS NULL
     AND created_at < NOW() - INTERVAL '5 minutes';

  -- 既にマッチ済みの行が残っていれば情報を返す (リトライ対応)
  SELECT room_code, matched_with INTO v_room, v_opponent
    FROM crystal_blast_queue
   WHERE user_id = v_uid AND matched_with IS NOT NULL
   LIMIT 1;
  IF v_room IS NOT NULL THEN
    RETURN QUERY SELECT 'matched'::TEXT, v_room, v_opponent;
    RETURN;
  END IF;

  -- 他に未マッチの待機者を探す (自分以外)
  SELECT user_id INTO v_opponent
    FROM crystal_blast_queue
   WHERE matched_with IS NULL
     AND user_id <> v_uid
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_opponent IS NOT NULL THEN
    -- room_code を生成し、両者をマッチ済みに
    v_room := substr(md5(random()::text || clock_timestamp()::text), 1, 8);

    UPDATE crystal_blast_queue
       SET matched_with = v_uid, room_code = v_room, updated_at = NOW()
     WHERE user_id = v_opponent;

    INSERT INTO crystal_blast_queue (user_id, room_code, matched_with)
    VALUES (v_uid, v_room, v_opponent)
    ON CONFLICT (user_id) DO UPDATE
      SET room_code = EXCLUDED.room_code,
          matched_with = EXCLUDED.matched_with,
          updated_at = NOW();

    RETURN QUERY SELECT 'matched'::TEXT, v_room, v_opponent;
    RETURN;
  END IF;

  -- 待機者がいなければ自分を未マッチで登録
  INSERT INTO crystal_blast_queue (user_id) VALUES (v_uid)
  ON CONFLICT (user_id) DO UPDATE
    SET created_at = NOW(),
        matched_with = NULL,
        room_code = NULL,
        updated_at = NOW();

  RETURN QUERY SELECT 'waiting'::TEXT, NULL::TEXT, NULL::UUID;
END;
$$;

GRANT EXECUTE ON FUNCTION crystal_blast_join_queue() TO authenticated;

-- 自分の待機行を削除 (キャンセル)
CREATE OR REPLACE FUNCTION crystal_blast_leave_queue()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  DELETE FROM crystal_blast_queue WHERE user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION crystal_blast_leave_queue() TO authenticated;

-- 自分の待機行のステータスを polling 用に返す
CREATE OR REPLACE FUNCTION crystal_blast_check_queue()
RETURNS TABLE (
  status      TEXT,
  room_code   TEXT,
  opponent_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row crystal_blast_queue%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'unauthorized'::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  SELECT * INTO v_row FROM crystal_blast_queue WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'absent'::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_row.matched_with IS NOT NULL THEN
    RETURN QUERY SELECT 'matched'::TEXT, v_row.room_code, v_row.matched_with;
  ELSE
    RETURN QUERY SELECT 'waiting'::TEXT, NULL::TEXT, NULL::UUID;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION crystal_blast_check_queue() TO authenticated;

-- ============================================
-- リーダーボード RPC (ソロモードのベストスコア)
-- ============================================
CREATE OR REPLACE FUNCTION get_crystal_blast_leaderboard(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id        UUID,
  user_name      TEXT,
  user_avatar    TEXT,
  best_score     INTEGER,
  max_chain      SMALLINT,
  achieved_at    TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH best_per_user AS (
    SELECT DISTINCT ON (user_id)
      user_id, score, max_chain, created_at
    FROM crystal_blast_solo_sessions
    ORDER BY user_id, score DESC, max_chain DESC, created_at ASC
  )
  SELECT
    bpu.user_id,
    u.name        AS user_name,
    u.avatar_url  AS user_avatar,
    bpu.score     AS best_score,
    bpu.max_chain,
    bpu.created_at AS achieved_at
  FROM best_per_user bpu
  JOIN users u ON u.id = bpu.user_id
  WHERE COALESCE(u.is_banned, FALSE) = FALSE
  ORDER BY bpu.score DESC, bpu.max_chain DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_crystal_blast_leaderboard(INTEGER) TO authenticated, anon;

-- ============================================
-- 対戦戦績 RPC (自分の通算 W/L)
-- ============================================
CREATE OR REPLACE FUNCTION get_crystal_blast_match_stats(p_user_id UUID)
RETURNS TABLE (
  wins   INTEGER,
  losses INTEGER,
  draws  INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE winner_id = p_user_id)::INTEGER AS wins,
    COUNT(*) FILTER (WHERE winner_id IS NOT NULL
                       AND winner_id <> p_user_id
                       AND (player1_id = p_user_id OR player2_id = p_user_id))::INTEGER AS losses,
    COUNT(*) FILTER (WHERE winner_id IS NULL
                       AND (player1_id = p_user_id OR player2_id = p_user_id))::INTEGER AS draws
  FROM crystal_blast_matches
  WHERE player1_id = p_user_id OR player2_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_crystal_blast_match_stats(UUID) TO authenticated, anon;
