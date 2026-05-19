-- ============================================
-- ID + パスワード ログイン対応
-- ============================================
-- メールアドレスを持たないユーザー (主にティーン) 向けに、
-- ID (username) + password でアカウントを作れるようにする。
--
-- 実装方針:
--   - Supabase Auth はメール必須なので、合成メール <username>@id.filmo.me を発行
--   - 表面上は username で操作 (users.username に正規 ID を持つ)
--   - メールが無いのでパスワード復旧用に「復旧コード」を発行・ハッシュ保存
--     (sha256 で十分。コード自体が ~72bit エントロピーあるため)
--
-- 制約:
--   - username は ^[a-z0-9_]{4,20}$ (case-sensitive で小文字統一)
--   - case-sensitive UNIQUE (アプリ側で小文字化して保存)
--   - 既存のメール登録ユーザーは username=NULL のままで影響なし

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD CONSTRAINT users_username_format_check
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{4,20}$');
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username
  ON users (username) WHERE username IS NOT NULL;

-- 復旧コードハッシュ (sha256 hex = 64 文字)
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT;
ALTER TABLE users ADD CONSTRAINT users_recovery_code_hash_format_check
  CHECK (recovery_code_hash IS NULL OR recovery_code_hash ~ '^[a-f0-9]{64}$');

-- 復旧コードを最後にリセットした日時 (security log 用)
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_rotated_at TIMESTAMPTZ;

COMMENT ON COLUMN users.username IS
  'ID ログイン用のユーザー名。メールを持たないユーザー向け。^[a-z0-9_]{4,20}$';
COMMENT ON COLUMN users.recovery_code_hash IS
  'ID ログインユーザーがパスワード忘れ時に使う復旧コードの sha256 hex。コード自体は登録時に 1 回だけ表示。';
