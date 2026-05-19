-- ============================================
-- うらにゃん。: 占い対象カードの relationship カテゴリーを拡充
-- ============================================
-- 「親、子供、親戚も選びたい」というフィードバックを受けて
-- 家族系・学校系・職場系のカテゴリーを追加。
-- 既存値 (self/friend/family/crush/partner/idol/other) は維持して後方互換を保つ。
--
-- 追加カテゴリー:
--   parent     親
--   child      子供
--   sibling    きょうだい
--   relative   親戚
--   classmate  クラスメイト
--   senior     先輩
--   coworker   同僚

ALTER TABLE uranyan_targets
  DROP CONSTRAINT IF EXISTS uranyan_targets_relationship_check;

ALTER TABLE uranyan_targets
  ADD CONSTRAINT uranyan_targets_relationship_check
  CHECK (relationship IS NULL OR relationship IN (
    'self',
    'parent', 'child', 'sibling', 'family', 'relative',
    'friend', 'classmate', 'senior', 'coworker',
    'crush', 'partner', 'idol',
    'other'
  ));
