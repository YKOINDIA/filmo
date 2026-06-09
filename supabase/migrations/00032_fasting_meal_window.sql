-- ============================================
-- Filmo ファスティング — 食事ウィンドウ (食べてよい時間帯)
-- ============================================
-- 16:8 などの「食べてよい時間帯」(例 12:00〜20:00) を 1 ユーザー 1 件で登録し、
-- 「次の食事までのカウントダウン」に使う。
--
-- 個人の予定なので、からだの記録 (00031) と同じく **本人のみ** の RLS。
-- コミュニティのフィードには一切出さない。

CREATE TABLE IF NOT EXISTS fasting_meal_windows (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- 食べてよい開始時刻 (ローカル時刻の時分)。例 12:00。
  eat_start   TIME NOT NULL,
  -- 食べてよい終了時刻。例 20:00。深夜跨ぎ (start > end) も許容。
  eat_end     TIME NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at 自動更新トリガ。
CREATE OR REPLACE FUNCTION fasting_meal_windows_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fasting_meal_windows_updated_at ON fasting_meal_windows;
CREATE TRIGGER trg_fasting_meal_windows_updated_at
  BEFORE UPDATE ON fasting_meal_windows
  FOR EACH ROW EXECUTE FUNCTION fasting_meal_windows_touch_updated_at();

-- ============================================
-- RLS — 本人のみ読み書き可 (個人の予定は非公開)
-- ============================================
ALTER TABLE fasting_meal_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fasting_meal_windows_select_own ON fasting_meal_windows;
CREATE POLICY fasting_meal_windows_select_own ON fasting_meal_windows
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_meal_windows_insert_own ON fasting_meal_windows;
CREATE POLICY fasting_meal_windows_insert_own ON fasting_meal_windows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_meal_windows_update_own ON fasting_meal_windows;
CREATE POLICY fasting_meal_windows_update_own ON fasting_meal_windows
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_meal_windows_delete_own ON fasting_meal_windows;
CREATE POLICY fasting_meal_windows_delete_own ON fasting_meal_windows
  FOR DELETE USING (auth.uid() = user_id);
