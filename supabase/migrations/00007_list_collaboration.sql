-- ============================================
-- リスト機能拡張: コラボレーション + フォーク + 投稿者属性
-- ============================================

-- 1. user_lists 拡張
ALTER TABLE user_lists ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN DEFAULT FALSE;
ALTER TABLE user_lists ADD COLUMN IF NOT EXISTS forked_from_list_id UUID REFERENCES user_lists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_lists_forked_from ON user_lists(forked_from_list_id) WHERE forked_from_list_id IS NOT NULL;

-- 2. list_items に「誰が追加したか」を記録
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_list_items_added_by ON list_items(added_by_user_id) WHERE added_by_user_id IS NOT NULL;

-- 既存 items のオーナーで埋める (リスト作成者が追加したものとして)
UPDATE list_items li
SET added_by_user_id = ul.user_id
FROM user_lists ul
WHERE li.list_id = ul.id AND li.added_by_user_id IS NULL;

-- 3. list_items の RLS を「コラボレーション対応」に更新
-- 既存ポリシーを削除して再作成
DROP POLICY IF EXISTS list_items_select ON list_items;
DROP POLICY IF EXISTS list_items_insert ON list_items;
DROP POLICY IF EXISTS list_items_update ON list_items;
DROP POLICY IF EXISTS list_items_delete ON list_items;

-- SELECT: 公開 OR 所有者
CREATE POLICY list_items_select ON list_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_lists
    WHERE id = list_id AND (is_public = TRUE OR auth.uid() = user_id)
  )
);

-- INSERT: 所有者 OR (コラボレーション可 AND 自分の名で追加)
CREATE POLICY list_items_insert ON list_items FOR INSERT WITH CHECK (
  added_by_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM user_lists
    WHERE id = list_id AND (
      auth.uid() = user_id
      OR (is_collaborative = TRUE AND is_public = TRUE)
    )
  )
);

-- UPDATE: 所有者のみ (position 並び替え等のため)
CREATE POLICY list_items_update ON list_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND auth.uid() = user_id)
);

-- DELETE: 所有者 OR 自分が追加したもの
CREATE POLICY list_items_delete ON list_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND auth.uid() = user_id)
  OR added_by_user_id = auth.uid()
);

-- 4. list_comments の RLS に update/delete を追加 (自分のコメントのみ)
DROP POLICY IF EXISTS list_comments_update ON list_comments;
DROP POLICY IF EXISTS list_comments_delete ON list_comments;
CREATE POLICY list_comments_update ON list_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY list_comments_delete ON list_comments FOR DELETE USING (auth.uid() = user_id);
