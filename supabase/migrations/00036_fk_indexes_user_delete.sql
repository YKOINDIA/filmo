-- ============================================
-- ユーザー削除タイムアウトの修正: FK カラムのインデックス補完
-- ============================================
-- 症状: auth.admin.deleteUser() が新規ユーザーですらタイムアウト (GoTrue 504)。
--       退会 API (/api/account/delete, App Store 5.1.1(v) 必須) が実質故障。
--
-- 原因: users(id) を参照する FK カラムにインデックスが無いテーブルがあり、
--       ユーザー削除のたびに CASCADE / SET NULL / NO ACTION の整合性チェックが
--       子テーブルのフルスキャンになる。
--       特に persons.created_by は 160万行超のフルスキャンで、これが主因。
--       (uq_persons_user_name は WHERE data_source='user' の部分インデックスのため
--        FK チェックには使えない)
--
-- 注意: 通常の CREATE INDEX は構築中そのテーブルへの書き込みをブロックする。
--       persons (160万行) でも数十秒程度の想定だが、適用はアクセスの少ない
--       時間帯を推奨。

-- ── 主因: 巨大テーブル persons ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_persons_created_by ON persons(created_by);

-- ── users(id) を参照する残りの未インデックス FK ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_threads_user ON feedback_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_list_comments_user ON list_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_resolved_by ON content_reports(resolved_by);
CREATE INDEX IF NOT EXISTS idx_person_edit_proposals_user ON person_edit_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_person_edit_proposals_reviewed_by ON person_edit_proposals(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_work_requests_reviewed_by ON work_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_edit_proposals_reviewed_by ON edit_proposals(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_crystal_blast_queue_matched ON crystal_blast_queue(matched_with);
CREATE INDEX IF NOT EXISTS idx_fasting_cheers_user ON fasting_cheers(user_id);

-- ── 二次カスケード先の FK ───────────────────────────────────────────────
-- users → feedback_threads (CASCADE) → feedback_messages (CASCADE)
CREATE INDEX IF NOT EXISTS idx_feedback_messages_thread ON feedback_messages(thread_id);
-- fasting_sessions 削除時の SET NULL 用
CREATE INDEX IF NOT EXISTS idx_fasting_posts_session ON fasting_posts(session_id);

-- ── reviewed_by (審査した管理者) の FK を SET NULL に変更 ────────────────
-- 現状は ON DELETE 指定なし (NO ACTION) のため、提案を審査したことのある
-- ユーザー (管理者) を削除しようとすると FK 違反で退会自体が失敗する。
ALTER TABLE work_requests DROP CONSTRAINT IF EXISTS work_requests_reviewed_by_fkey;
ALTER TABLE work_requests ADD CONSTRAINT work_requests_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE edit_proposals DROP CONSTRAINT IF EXISTS edit_proposals_reviewed_by_fkey;
ALTER TABLE edit_proposals ADD CONSTRAINT edit_proposals_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE person_edit_proposals DROP CONSTRAINT IF EXISTS person_edit_proposals_reviewed_by_fkey;
ALTER TABLE person_edit_proposals ADD CONSTRAINT person_edit_proposals_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
