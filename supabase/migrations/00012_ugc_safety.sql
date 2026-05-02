-- ============================================
-- UGC Safety: Reports & Blocks (Apple Guideline 1.2)
-- ============================================
-- App Store 審査ガイドライン 1.2 で必須:
--   ・不適切コンテンツの通報機能
--   ・ユーザーのブロック機能
--   ・24 時間以内の対応体制
-- 既存の review_reports は legacy としてそのまま残し、
-- 統一の content_reports / user_blocks を新規追加する。

-- ============================================
-- content_reports: レビュー・リスト・プロフィールの通報
-- ============================================
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('review', 'list', 'user')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'copyright', 'other')),
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 同一ユーザーが同一対象を二重通報しないようにする
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_reports_reporter_target
  ON content_reports (reporter_id, target_type, target_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_target
  ON content_reports (target_type, target_id);

-- ============================================
-- user_blocks: ユーザー間ブロック
-- ============================================
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker
  ON user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked
  ON user_blocks (blocked_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- content_reports: 通報した本人のみ自分の通報を読める／書ける。管理者は service-role でアクセス
CREATE POLICY content_reports_select_own ON content_reports
  FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY content_reports_insert_own ON content_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- user_blocks: 自分の作ったブロック行のみ操作可能。被ブロック側は読めない（プライバシー）
CREATE POLICY user_blocks_select_own ON user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY user_blocks_insert_own ON user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY user_blocks_delete_own ON user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);
