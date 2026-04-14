-- ============================================
-- Migration 00003: データ戦略基盤
-- ユーザー作品登録、修正提案、マルチソース対応
-- ============================================

-- ────────────────────────────────────────────
-- 1. movies テーブル拡張
-- ────────────────────────────────────────────

-- データソース識別（tmdb / annict / user）
ALTER TABLE movies ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'tmdb';

-- ユーザー登録作品の作成者
ALTER TABLE movies ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 管理者検証済みフラグ（TMDB/Annict由来は自動true）
ALTER TABLE movies ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 重複統合先（統合された旧作品はこのIDの作品に吸収済み）
ALTER TABLE movies ADD COLUMN IF NOT EXISTS merged_into INTEGER REFERENCES movies(id) ON DELETE SET NULL;

-- Annict連携用ID
ALTER TABLE movies ADD COLUMN IF NOT EXISTS annict_id INTEGER;

-- tmdb_id の NOT NULL 制約を外す（ユーザー登録作品はTMDB IDを持たない）
ALTER TABLE movies ALTER COLUMN tmdb_id DROP NOT NULL;

-- tmdb_id の UNIQUE 制約を条件付きに変更（NULLは複数OK、非NULLはユニーク）
-- PostgreSQL の UNIQUE は NULL を複数許可するのでDROP不要

-- data_source の CHECK 制約
ALTER TABLE movies ADD CONSTRAINT chk_movies_data_source
  CHECK (data_source IN ('tmdb', 'annict', 'user'));

-- TMDB由来は自動verified
UPDATE movies SET is_verified = TRUE WHERE data_source = 'tmdb';

-- ユーザー登録作品用の負のID生成シーケンス
CREATE SEQUENCE IF NOT EXISTS user_work_id_seq START WITH -1 INCREMENT BY -1 MAXVALUE -1 NO CYCLE;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_movies_data_source ON movies(data_source);
CREATE INDEX IF NOT EXISTS idx_movies_created_by ON movies(created_by);
CREATE INDEX IF NOT EXISTS idx_movies_annict_id ON movies(annict_id) WHERE annict_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movies_merged_into ON movies(merged_into) WHERE merged_into IS NOT NULL;
-- タイトル検索用（ユーザー作品の重複検出に使用）
CREATE INDEX IF NOT EXISTS idx_movies_title_lower ON movies(LOWER(title));

-- ────────────────────────────────────────────
-- 2. 作品リクエストテーブル
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_title TEXT,
  media_type TEXT NOT NULL DEFAULT 'tv' CHECK (media_type IN ('movie', 'tv', 'anime')),
  year INTEGER,
  description TEXT,
  poster_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  movie_id INTEGER REFERENCES movies(id),  -- 承認後に作成/紐付けされた作品ID
  admin_note TEXT,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_requests_status ON work_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_requests_user ON work_requests(user_id, created_at DESC);

ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_requests_select ON work_requests FOR SELECT USING (true);
CREATE POLICY work_requests_insert ON work_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY work_requests_update_own ON work_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- ────────────────────────────────────────────
-- 3. 編集提案テーブル（作品データ修正）
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS edit_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,  -- 'title', 'original_title', 'overview', 'release_date', 'runtime', 'genres'
  current_value TEXT,
  proposed_value TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edit_proposals_status ON edit_proposals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edit_proposals_movie ON edit_proposals(movie_id);
CREATE INDEX IF NOT EXISTS idx_edit_proposals_user ON edit_proposals(user_id, created_at DESC);

ALTER TABLE edit_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY edit_proposals_select ON edit_proposals FOR SELECT USING (true);
CREATE POLICY edit_proposals_insert ON edit_proposals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- 4. 人物/キャスト編集提案テーブル
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS person_edit_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES persons(id) ON DELETE SET NULL,
  movie_id INTEGER REFERENCES movies(id) ON DELETE SET NULL,
  proposal_type TEXT NOT NULL CHECK (proposal_type IN (
    'add_person',     -- 新しい人物を追加
    'edit_person',    -- 人物情報を修正
    'add_credit',     -- 作品にキャスト/スタッフを追加
    'remove_credit'   -- 作品からキャスト/スタッフを削除
  )),
  proposed_data JSONB NOT NULL,
  -- add_person: {name, biography, birthday, place_of_birth, profile_url}
  -- edit_person: {field_name, current_value, proposed_value}
  -- add_credit: {person_name, role_type('cast'|'crew'), character, job, department}
  -- remove_credit: {person_name, reason}
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_edit_proposals_status ON person_edit_proposals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_person_edit_proposals_movie ON person_edit_proposals(movie_id);

ALTER TABLE person_edit_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY person_edit_proposals_select ON person_edit_proposals FOR SELECT USING (true);
CREATE POLICY person_edit_proposals_insert ON person_edit_proposals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- 5. データ貢献ログ（ポイント付与管理）
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_type TEXT NOT NULL CHECK (contribution_type IN (
    'register_work',     -- 作品を簡易登録
    'request_work',      -- 作品をリクエスト
    'edit_proposal',     -- 修正提案が承認
    'person_proposal',   -- キャスト提案が承認
    'add_cast'           -- ユーザー作品にキャスト追加
  )),
  reference_id UUID,     -- 関連するwork_requests.id / edit_proposals.id 等
  movie_id INTEGER REFERENCES movies(id) ON DELETE SET NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awarded', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_contributions_user ON data_contributions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_contributions_type ON data_contributions(contribution_type, status);

ALTER TABLE data_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_contributions_select ON data_contributions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY data_contributions_insert ON data_contributions FOR INSERT
  WITH CHECK (true);  -- サーバーサイドから挿入

-- ────────────────────────────────────────────
-- 6. movies テーブルの RLS 拡張
-- ユーザー登録作品は作成者のみ編集可能
-- ────────────────────────────────────────────

-- movies テーブルにRLSが未設定の場合のみ有効化
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'movies' AND rowsecurity = true
  ) THEN
    ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 全員読み取り可能
DO $$ BEGIN
  CREATE POLICY movies_select ON movies FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 挿入: 誰でも可（サーバーサイドキャッシュ + ユーザー登録）
DO $$ BEGIN
  CREATE POLICY movies_insert ON movies FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 更新: TMDB/Annict は service_role のみ、ユーザー作品は作成者のみ
DO $$ BEGIN
  CREATE POLICY movies_update ON movies FOR UPDATE
    USING (
      data_source IN ('tmdb', 'annict')
      OR (data_source = 'user' AND auth.uid() = created_by)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
