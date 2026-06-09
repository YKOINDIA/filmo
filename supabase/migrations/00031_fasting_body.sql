-- ============================================
-- Filmo ファスティング — からだの記録 (体重・体の変化)
-- ============================================
-- ファスティングの効果を実感できるよう、体重・体脂肪・体調メモを記録する。
--
-- セッションや回復食 (00030) は「いま一緒に頑張る仲間」を見せるため公開だが、
-- 体重などは機微な健康データなので **本人のみ** (Agey と同じ RLS)。
-- コミュニティのフィードには一切出さない。
--
-- 1 日 1 レコード。同じ日に再入力したら上書き (UNIQUE + upsert)。

CREATE TABLE IF NOT EXISTS fasting_body_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 記録日 (ローカル日付)。1 日 1 件。
  logged_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 体重 (kg)。0 < w < 500。任意。
  weight_kg   NUMERIC(5,2) CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg < 500)),
  -- 体脂肪率 (%)。任意。
  body_fat    NUMERIC(4,1) CHECK (body_fat IS NULL OR (body_fat >= 0 AND body_fat <= 100)),
  -- 体の変化メモ (肌の調子・お腹のすっきり感・体調など)。最大 500 文字。
  note        TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, logged_on)
);

-- 自分の記録を新しい順に取得。
CREATE INDEX IF NOT EXISTS idx_fasting_body_user
  ON fasting_body_logs (user_id, logged_on DESC);

-- updated_at 自動更新トリガ。
CREATE OR REPLACE FUNCTION fasting_body_logs_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fasting_body_logs_updated_at ON fasting_body_logs;
CREATE TRIGGER trg_fasting_body_logs_updated_at
  BEFORE UPDATE ON fasting_body_logs
  FOR EACH ROW EXECUTE FUNCTION fasting_body_logs_touch_updated_at();

-- ============================================
-- RLS — 本人のみ読み書き可 (健康データは非公開)
-- ============================================
ALTER TABLE fasting_body_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fasting_body_logs_select_own ON fasting_body_logs;
CREATE POLICY fasting_body_logs_select_own ON fasting_body_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_body_logs_insert_own ON fasting_body_logs;
CREATE POLICY fasting_body_logs_insert_own ON fasting_body_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_body_logs_update_own ON fasting_body_logs;
CREATE POLICY fasting_body_logs_update_own ON fasting_body_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_body_logs_delete_own ON fasting_body_logs;
CREATE POLICY fasting_body_logs_delete_own ON fasting_body_logs
  FOR DELETE USING (auth.uid() = user_id);
