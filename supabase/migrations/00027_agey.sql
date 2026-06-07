-- ============================================
-- Filmo Agey (年齢・人物メモ)
-- ============================================
-- 解決したい課題:
--   社会人仲間・子供の学校の友達・その兄弟など、「名前」や「だいたいの年齢」を
--   忘れてしまうのを防ぎたい。多くの場合、相手の正確な生年月日は分からない。
--
-- そのため設計上の最重要ポイントは「生年月日は任意」であること。
--   - 正確な生年月日が分かる → birth_year/month/day を入れて正確な年齢を自動計算
--   - だいたいの年齢しか分からない → approx_age + approx_age_as_of で「約◯歳」を継続計算
--   - 年齢が全く分からない → 名前 + ふりがな + 間柄 + メモ だけでも登録できる
--
-- うらにゃん。の uranyan_targets (00020) と同じ「1 ユーザー複数カード + 本人のみ RLS」設計。
-- 100K+ ユーザー想定。1 人あたり数件〜数十件 (園のクラス全員・会社の人脈など) を見込む。
--
-- このマイグレーションは冪等。テーブルが既に古い版で作られていても
-- ALTER ... IF NOT EXISTS / DROP NOT NULL で現行スキーマへ収束する。

-- ============================================
-- agey_people: 人物メモのカード
-- ============================================
CREATE TABLE IF NOT EXISTS agey_people (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 名前 (必須)。1〜60 文字。
  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  -- ふりがな / 読み (任意)。名前を思い出す手がかり用。
  reading           TEXT CHECK (reading IS NULL OR char_length(reading) <= 60),
  -- 間柄・つながり (任意)。例: 会社の同期 / たろうの友達 / さくらの弟
  relation          TEXT CHECK (relation IS NULL OR char_length(relation) <= 60),
  -- 生年月日: 分かる場合のみ。3 つそろって初めて正確な年齢を計算する。
  birth_year        SMALLINT CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100),
  birth_month       SMALLINT CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12),
  birth_day         SMALLINT CHECK (birth_day IS NULL OR birth_day BETWEEN 1 AND 31),
  -- 概算年齢: 生年月日が不明なときの「だいたい◯歳」。
  -- approx_age_as_of (基準日) からの経過年数を足して「約◯歳」を継続表示する。
  approx_age        SMALLINT CHECK (approx_age IS NULL OR approx_age BETWEEN 0 AND 150),
  approx_age_as_of  DATE,
  -- メモ (親の名前・特徴・どこで知り合ったか等)。NULL 可、最大 1000 文字。
  note              TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  -- グループタグ (保育園・小学校のクラス・部活・会社など) の配列。検索/絞り込み用。
  tags              TEXT[] NOT NULL DEFAULT '{}',
  -- カードの絵文字アイコン (1 グリフ想定だが緩めに 8 文字まで)。NULL 可。
  emoji             TEXT CHECK (emoji IS NULL OR char_length(emoji) BETWEEN 1 AND 8),
  -- カード色 (#RRGGBB)。一覧での識別用。NULL 可。
  color_tag         TEXT CHECK (color_tag IS NULL OR color_tag ~ '^#[0-9a-fA-F]{6}$'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 旧版テーブルからの移行 (冪等) ───────────────────────────────────────
-- birth_* を NULL 許容に。新カラムを追加。
ALTER TABLE agey_people ALTER COLUMN birth_year  DROP NOT NULL;
ALTER TABLE agey_people ALTER COLUMN birth_month DROP NOT NULL;
ALTER TABLE agey_people ALTER COLUMN birth_day   DROP NOT NULL;
ALTER TABLE agey_people ADD COLUMN IF NOT EXISTS reading          TEXT;
ALTER TABLE agey_people ADD COLUMN IF NOT EXISTS relation         TEXT;
ALTER TABLE agey_people ADD COLUMN IF NOT EXISTS approx_age       SMALLINT;
ALTER TABLE agey_people ADD COLUMN IF NOT EXISTS approx_age_as_of DATE;

-- 一覧表示 (ユーザー単位・登録順) の高速化。
CREATE INDEX IF NOT EXISTS idx_agey_people_user
  ON agey_people (user_id, created_at DESC);

-- タグでの絞り込み (tags @> ARRAY['...']) を高速化。
CREATE INDEX IF NOT EXISTS idx_agey_people_tags
  ON agey_people USING GIN (tags);

-- 旧版の「name+birth で一意」インデックスは、生年月日 NULL が増えると
-- 役に立たない (NULL 同士は重複扱いされない) ため撤去する。
-- 同名・年齢不明の別人を複数登録できる方が、このサービスでは自然。
DROP INDEX IF EXISTS uq_agey_people_user_name_birth;

-- updated_at 自動更新トリガ。
CREATE OR REPLACE FUNCTION agey_people_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agey_people_updated_at ON agey_people;
CREATE TRIGGER trg_agey_people_updated_at
  BEFORE UPDATE ON agey_people
  FOR EACH ROW EXECUTE FUNCTION agey_people_touch_updated_at();

-- ============================================
-- RLS — 本人の行のみ読み書き可
-- ============================================
ALTER TABLE agey_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agey_people_select_own ON agey_people;
CREATE POLICY agey_people_select_own ON agey_people
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agey_people_insert_own ON agey_people;
CREATE POLICY agey_people_insert_own ON agey_people
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agey_people_update_own ON agey_people;
CREATE POLICY agey_people_update_own ON agey_people
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agey_people_delete_own ON agey_people;
CREATE POLICY agey_people_delete_own ON agey_people
  FOR DELETE USING (auth.uid() = user_id);
