-- ============================================
-- うらにゃん。: 期間限定占い (menu='period') を許可
-- ============================================
-- 既存 menu CHECK 制約 (life / compat / group_compat) に 'period' を追加。
-- 期間 (テスト期間・夏休み・推し活ウィーク等) のまとめ運勢を
-- uranyan_readings に保存できるようにする。

ALTER TABLE uranyan_readings DROP CONSTRAINT IF EXISTS uranyan_readings_menu_check;

ALTER TABLE uranyan_readings ADD CONSTRAINT uranyan_readings_menu_check
  CHECK (menu IN ('life','compat','group_compat','period'));
