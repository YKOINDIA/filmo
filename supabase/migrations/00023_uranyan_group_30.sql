-- ============================================
-- うらにゃん。: グループ相性の上限を 8 人 → 30 人に拡張
-- ============================================
-- 「家族 + 仲良し友達」を追加するとすぐ 8 人上限になる、というフィードバックを受けて拡大。
-- 30 人 = C(30,2) = 435 ペアと多くなるが、計算は数ms で完了し、
-- UI 側は「全ペア」セクションを折りたたみ表示にして可読性を保つ。

-- 既存 CHECK 制約 (1〜8) を置き換え (1〜30)
ALTER TABLE uranyan_readings
  DROP CONSTRAINT IF EXISTS uranyan_readings_target_names_check;
ALTER TABLE uranyan_readings
  ADD CONSTRAINT uranyan_readings_target_names_check
  CHECK (array_length(target_names, 1) BETWEEN 1 AND 30);
