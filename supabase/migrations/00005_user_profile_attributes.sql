-- ============================================
-- ユーザープロフィール属性 (任意入力)
--
-- レコメンド (世代 / 地域マッチ) に使うが、
-- gender / birth / hometown / current_location は
-- 公開プロフィール (/u/[id]) には出さない。
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say'));

-- 生年月日: 全項目NULL可。recommendation では birth_year のみあれば十分機能する。
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year INTEGER
  CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2030));
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_month INTEGER
  CHECK (birth_month IS NULL OR (birth_month BETWEEN 1 AND 12));
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_day INTEGER
  CHECK (birth_day IS NULL OR (birth_day BETWEEN 1 AND 31));

-- ISO 3166-1 alpha-2 (例: 'JP', 'US')。recommendation で TMDB の watch_region / origin_country に使う。
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT
  CHECK (country IS NULL OR length(country) = 2);

-- 出身 / 現住所は自由文字列 (都道府県名・市町村名・国名等を許容)
ALTER TABLE users ADD COLUMN IF NOT EXISTS hometown TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_location TEXT;

-- birth_year は recommendation の絞り込みで使うので idx を張る (10万ユーザースケール想定)
CREATE INDEX IF NOT EXISTS idx_users_birth_year ON users(birth_year) WHERE birth_year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country) WHERE country IS NOT NULL;
