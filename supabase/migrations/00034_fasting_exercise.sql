-- ============================================
-- Filmo ファスティング — 運動の記録
-- ============================================
-- ファスティング中の運動 (ストレッチ・ウォーキング・サイクリング1時間・
-- 筋トレ 懸垂30回 など) を記録する。1 日に複数件 OK。
--
-- からだの記録 (00031) と同じく機微な健康・行動データなので **本人のみ** の RLS。
-- コミュニティのフィードには一切出さない。

CREATE TABLE IF NOT EXISTS fasting_exercise_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 記録日 (ローカル日付)。
  logged_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 種目キー (walk / strength / yoga など。app 側の EXERCISE_TYPES と一致)。
  type        TEXT NOT NULL,
  -- 量 (任意)。ウォーキング=分, 筋トレ=回数, ランニング=km など。0 以上。
  amount      NUMERIC(8,1) CHECK (amount IS NULL OR amount >= 0),
  -- 量の単位 (min / reps / km)。amount とセット。
  unit        TEXT CHECK (unit IS NULL OR unit IN ('min', 'reps', 'km')),
  -- 補足メモ (例「懸垂30回・腕立て20回」)。最大 300 文字。
  note        TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 自分の記録を新しい順に取得。
CREATE INDEX IF NOT EXISTS idx_fasting_exercise_user
  ON fasting_exercise_logs (user_id, logged_on DESC, created_at DESC);

-- ============================================
-- RLS — 本人のみ読み書き可 (行動データは非公開)
-- ============================================
ALTER TABLE fasting_exercise_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fasting_exercise_select_own ON fasting_exercise_logs;
CREATE POLICY fasting_exercise_select_own ON fasting_exercise_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_exercise_insert_own ON fasting_exercise_logs;
CREATE POLICY fasting_exercise_insert_own ON fasting_exercise_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_exercise_update_own ON fasting_exercise_logs;
CREATE POLICY fasting_exercise_update_own ON fasting_exercise_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_exercise_delete_own ON fasting_exercise_logs;
CREATE POLICY fasting_exercise_delete_own ON fasting_exercise_logs
  FOR DELETE USING (auth.uid() = user_id);
