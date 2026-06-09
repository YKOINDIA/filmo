-- ============================================
-- Filmo Agey: 紐づけ (家族・ペット) 追加
-- ============================================
-- 「会社の同僚」のカードに、その人の妻・子供・ペットなどを
-- ぶら下げて一緒にメモできるようにする。
--   例) 田中さん (会社の同僚)
--        ├ 奥さん
--        ├ 長男 (約5歳)
--        └ 犬 (ポチ)
--
-- 設計: agey_people 自身への自己参照 (linked_to)。
--   - linked_to IS NULL      → トップレベルの人物 (友人・知人本人)
--   - linked_to = 親カードの id → その人に紐づくメンバー (家族・ペット)
-- ネストは 1 段のみ運用 (メンバーにさらにメンバーは付けない)。アプリ側で制御する。
--
-- 親を消したら、ぶら下がるメンバーも一緒に消える (ON DELETE CASCADE)。
-- 同一ユーザーの行同士のみ紐づく前提 (RLS が user_id を担保。アプリ側でも親と同じ user_id を入れる)。
--
-- このマイグレーションは冪等。

ALTER TABLE agey_people
  ADD COLUMN IF NOT EXISTS linked_to UUID
  REFERENCES agey_people(id) ON DELETE CASCADE;

-- 親カード配下のメンバーを引く (linked_to = :id) ための部分インデックス。
-- メンバーを持つ親は一部なので、NULL を除いた部分インデックスにする。
CREATE INDEX IF NOT EXISTS idx_agey_people_linked_to
  ON agey_people (linked_to)
  WHERE linked_to IS NOT NULL;
