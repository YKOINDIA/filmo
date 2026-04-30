-- ============================================
-- ユーザープロフィールの公開/非公開切替
-- ============================================
-- /u/[id] の公開ページ表示を制御するフラグ。
-- 既存ユーザーはデフォルト公開（後方互換）。
-- ユーザー本人が Settings から切り替え可能。

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN NOT NULL DEFAULT TRUE;

-- 公開プロフィール一覧などで頻繁に WHERE で叩くので index を張る
CREATE INDEX IF NOT EXISTS idx_users_is_profile_public
  ON users (is_profile_public) WHERE is_profile_public = TRUE;
