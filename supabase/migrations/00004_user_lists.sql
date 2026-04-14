-- ============================================
-- ユーザー作品リスト（Letterboxd風）
-- ============================================

-- リスト
CREATE TABLE IF NOT EXISTS user_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT TRUE,
  is_ranked BOOLEAN DEFAULT FALSE,
  cover_movie_id INTEGER,
  likes_count INTEGER DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- リストアイテム
CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, movie_id)
);

-- リストいいね
CREATE TABLE IF NOT EXISTS list_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, list_id)
);

-- リストコメント
CREATE TABLE IF NOT EXISTS list_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_user_lists_user ON user_lists(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_lists_public ON user_lists(is_public, likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_user_lists_slug ON user_lists(slug);
CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id, position);
CREATE INDEX IF NOT EXISTS idx_list_items_movie ON list_items(movie_id);
CREATE INDEX IF NOT EXISTS idx_list_likes_list ON list_likes(list_id);
CREATE INDEX IF NOT EXISTS idx_list_likes_user ON list_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_list_comments_list ON list_comments(list_id, created_at DESC);

-- RLS
ALTER TABLE user_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_comments ENABLE ROW LEVEL SECURITY;

-- user_lists: 公開リストは誰でも閲覧、自分のみ書き込み
CREATE POLICY user_lists_select ON user_lists FOR SELECT USING (is_public = TRUE OR auth.uid() = user_id);
CREATE POLICY user_lists_insert ON user_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_lists_update ON user_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY user_lists_delete ON user_lists FOR DELETE USING (auth.uid() = user_id);

-- list_items: リストが公開なら閲覧可、リスト所有者のみ書き込み
CREATE POLICY list_items_select ON list_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND (is_public = TRUE OR auth.uid() = user_id))
);
CREATE POLICY list_items_insert ON list_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND auth.uid() = user_id)
);
CREATE POLICY list_items_update ON list_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND auth.uid() = user_id)
);
CREATE POLICY list_items_delete ON list_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND auth.uid() = user_id)
);

-- list_likes
CREATE POLICY list_likes_select ON list_likes FOR SELECT USING (true);
CREATE POLICY list_likes_insert ON list_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY list_likes_delete ON list_likes FOR DELETE USING (auth.uid() = user_id);

-- list_comments
CREATE POLICY list_comments_select ON list_comments FOR SELECT USING (true);
CREATE POLICY list_comments_insert ON list_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY list_comments_delete ON list_comments FOR DELETE USING (auth.uid() = user_id);

-- items_count 自動更新トリガー
CREATE OR REPLACE FUNCTION update_list_items_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_lists SET items_count = items_count + 1, updated_at = NOW() WHERE id = NEW.list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_lists SET items_count = items_count - 1, updated_at = NOW() WHERE id = OLD.list_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_list_item_change ON list_items;
CREATE TRIGGER on_list_item_change
  AFTER INSERT OR DELETE ON list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_list_items_count();

-- likes_count 自動更新トリガー
CREATE OR REPLACE FUNCTION update_list_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_lists SET likes_count = likes_count + 1 WHERE id = NEW.list_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_lists SET likes_count = likes_count - 1 WHERE id = OLD.list_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_list_like_change ON list_likes;
CREATE TRIGGER on_list_like_change
  AFTER INSERT OR DELETE ON list_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_list_likes_count();
