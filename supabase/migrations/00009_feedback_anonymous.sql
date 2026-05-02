-- ============================================
-- フィードバックの匿名提出に対応
-- /support ページからログインなしで問い合わせできるようにする
-- ============================================

-- user_id を nullable に変更 (匿名提出で NULL を許可)
ALTER TABLE feedback_threads ALTER COLUMN user_id DROP NOT NULL;

-- 匿名送信者の連絡先を保存する列を追加
ALTER TABLE feedback_threads ADD COLUMN IF NOT EXISTS submitter_email TEXT;
ALTER TABLE feedback_threads ADD COLUMN IF NOT EXISTS submitter_name TEXT;

-- 匿名 (user_id IS NULL) の場合、必ず submitter_email を要求 (アプリ側 + DB側両方で)
ALTER TABLE feedback_threads ADD CONSTRAINT feedback_threads_anon_email
  CHECK (user_id IS NOT NULL OR submitter_email IS NOT NULL);

-- 匿名送信用の index (admin 検索効率化)
CREATE INDEX IF NOT EXISTS idx_feedback_threads_anon
  ON feedback_threads(submitter_email, created_at DESC)
  WHERE user_id IS NULL;
