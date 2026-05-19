-- ============================================
-- うらにゃん。(Filmo 占い)
-- ============================================
-- 三柱推命 (生まれた年・月・日) ベースの 10 代向けエンタメ占い。
-- 「毒舌な猫 (ニャンじろう) と おちゃめな犬 (ポチ)」の掛け合いで結果を出す。
--
-- 占い結果自体は生年月日から決定論的に生成できるので保存しない。
-- 保存するのは「占い対象カード (友達・家族・推し etc)」のみ。
--
-- 自分自身の生年月日は users.birth_year/month/day (00005) を再利用する。
-- ユーザー自身のキャラ選好 (猫種・犬種) は users 側に持たせる。

-- ============================================
-- users: キャラ選好 2 カラム追加
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS uranyan_cat_breed TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS uranyan_dog_breed TEXT;

-- ============================================
-- uranyan_targets: 占い対象カード
-- ============================================
-- 自分以外の占いたい相手 (友達・家族・恋・推し etc) を 1 ユーザー複数登録できる。
-- 100K+ ユーザー想定。1 人あたり数件〜数十件を見込む。
CREATE TABLE IF NOT EXISTS uranyan_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  -- 関係性ラベル: 表示用の自由文字列だが UI 側でプリセット選択にする。
  -- NULL 可。空文字より NULL を優先。
  relationship  TEXT
                CHECK (relationship IS NULL OR relationship IN
                  ('self','friend','family','crush','partner','idol','other')),
  -- 生年月日: 三柱推命の必須入力。すべて NOT NULL。
  -- (users 側は NULL 可だが、こちらは「占うために登録する」目的なので必須)
  birth_year    INTEGER NOT NULL CHECK (birth_year BETWEEN 1900 AND 2030),
  birth_month   SMALLINT NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_day     SMALLINT NOT NULL CHECK (birth_day BETWEEN 1 AND 31),
  -- カード色 (#RRGGBB)。一覧で並べたときの識別用。NULL 可。
  color_tag     TEXT CHECK (color_tag IS NULL OR color_tag ~ '^#[0-9a-fA-F]{6}$'),
  -- カードの絵文字アイコン (1 グリフ想定だが緩めに 8 文字まで許可)
  emoji         TEXT CHECK (emoji IS NULL OR char_length(emoji) BETWEEN 1 AND 8),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uranyan_targets_user
  ON uranyan_targets (user_id, created_at DESC);

-- 同じユーザーが同じ名前 + 生年月日を二重登録しないようにする。
-- (同名で別人が居る可能性はあるので birth とのセットで一意性)
CREATE UNIQUE INDEX IF NOT EXISTS uq_uranyan_targets_user_name_birth
  ON uranyan_targets (user_id, LOWER(name), birth_year, birth_month, birth_day);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE uranyan_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY uranyan_targets_select_own ON uranyan_targets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY uranyan_targets_insert_own ON uranyan_targets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY uranyan_targets_update_own ON uranyan_targets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY uranyan_targets_delete_own ON uranyan_targets
  FOR DELETE USING (auth.uid() = user_id);
