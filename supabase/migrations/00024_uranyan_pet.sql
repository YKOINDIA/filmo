-- ============================================
-- うらにゃん。: 関係カテゴリーに 'pet' を追加
-- ============================================
-- 00023 で追加した relationship CHECK 制約に 'pet' を追加。
-- 算命学・宿曜は生年月日があれば計算できるため、犬・猫・うさぎ等の
-- 愛するペットとの相性占いも可能。

ALTER TABLE uranyan_targets
  DROP CONSTRAINT IF EXISTS uranyan_targets_relationship_check;

ALTER TABLE uranyan_targets
  ADD CONSTRAINT uranyan_targets_relationship_check
  CHECK (relationship IS NULL OR relationship IN (
    'self',
    'parent', 'child', 'sibling', 'family', 'relative', 'pet',
    'friend', 'classmate', 'senior', 'coworker',
    'crush', 'partner', 'idol',
    'other'
  ));
