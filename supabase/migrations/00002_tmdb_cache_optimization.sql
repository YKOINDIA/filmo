-- ============================================
-- TMDB APIキャッシュ最適化
-- - movies.full_response カラム追加
-- - persons テーブル（actors/directors統合）
-- - キャッシュ検索用インデックス
-- ============================================

-- movies テーブルに full_response カラム追加（TMDB APIレスポンス全体を保存）
ALTER TABLE movies ADD COLUMN IF NOT EXISTS full_response JSONB;

-- persons テーブル（actors/directors を統合した汎用キャッシュ）
CREATE TABLE IF NOT EXISTS persons (
  id INTEGER PRIMARY KEY,
  tmdb_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  profile_path TEXT,
  biography TEXT,
  birthday DATE,
  place_of_birth TEXT,
  known_for JSONB DEFAULT '[]',
  full_response JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- キャッシュ検索用インデックス
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id_media_type ON movies (tmdb_id, media_type);
CREATE INDEX IF NOT EXISTS idx_movies_cached_at ON movies (cached_at);
CREATE INDEX IF NOT EXISTS idx_persons_tmdb_id ON persons (tmdb_id);
CREATE INDEX IF NOT EXISTS idx_persons_cached_at ON persons (cached_at);
