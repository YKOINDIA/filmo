-- ============================================
-- Filmo Agey: ニックネーム (あだ名) 追加
-- ============================================
-- 「本名は思い出せないけど "ゆうくん" は分かる」のように、
-- 普段の呼び名で人物を引けるようにする。検索対象にも含める。
-- 任意項目。最大 60 文字。

ALTER TABLE agey_people ADD COLUMN IF NOT EXISTS nickname TEXT
  CHECK (nickname IS NULL OR char_length(nickname) <= 60);
