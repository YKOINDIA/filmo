-- ============================================
-- Filmo ファスティング — マイプラン (やり方・食事の種類・継続目標)
-- ============================================
-- 「毎日16:8」「1日1食(OMAD)を1年」など、繰り返し前提のスタイルと
-- 食事の種類・継続目標日数を 1 ユーザー 1 件で登録する。
-- 個々のセッションはこれまで通り fasting_sessions に積み、
-- このプランは「いまどんなやり方を、いつから、何日目標で続けているか」を表す。
--
-- 個人の方針なので、からだの記録 (00031)・食事ウィンドウ (00032) と同じく
-- **本人のみ** の RLS。コミュニティのフィードには出さない。

CREATE TABLE IF NOT EXISTS fasting_plans (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- スタイルキー (16_8 / omad / custom など。app 側の FASTING_STYLES と一致)。
  style       TEXT NOT NULL,
  -- 既定の目標時間 (h)。スタイルに応じた値。1〜168。
  target_hours INT NOT NULL CHECK (target_hours >= 1 AND target_hours <= 168),
  -- 継続目標日数 (例 365)。NULL は「無期限・期限なし」。
  goal_days   INT CHECK (goal_days IS NULL OR (goal_days >= 1 AND goal_days <= 3650)),
  -- 食事の種類 (複数可)。app 側の FOOD_TYPES のキー配列。
  food_types  TEXT[] NOT NULL DEFAULT '{}',
  -- 食事に関する自由メモ。最大 300 文字。
  food_note   TEXT CHECK (food_note IS NULL OR char_length(food_note) <= 300),
  -- プランを始めた日 (ローカル日付)。継続日数の起点。
  started_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 自動更新トリガ。
CREATE OR REPLACE FUNCTION fasting_plans_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fasting_plans_updated_at ON fasting_plans;
CREATE TRIGGER trg_fasting_plans_updated_at
  BEFORE UPDATE ON fasting_plans
  FOR EACH ROW EXECUTE FUNCTION fasting_plans_touch_updated_at();

-- ============================================
-- RLS — 本人のみ読み書き可 (個人の方針は非公開)
-- ============================================
ALTER TABLE fasting_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fasting_plans_select_own ON fasting_plans;
CREATE POLICY fasting_plans_select_own ON fasting_plans
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_plans_insert_own ON fasting_plans;
CREATE POLICY fasting_plans_insert_own ON fasting_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_plans_update_own ON fasting_plans;
CREATE POLICY fasting_plans_update_own ON fasting_plans
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_plans_delete_own ON fasting_plans;
CREATE POLICY fasting_plans_delete_own ON fasting_plans
  FOR DELETE USING (auth.uid() = user_id);
