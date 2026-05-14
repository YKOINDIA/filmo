-- ============================================
-- 作品登録の体験向上
-- ============================================
-- - 年のみ入力された場合に「2025/01/01」と誤表示される問題を解消する
--   release_year_only フラグを追加。
-- - 公式サイト URL を movies / work_requests で保持。
-- - 作品リクエストに監督・キャスト候補を添えて送れるようにする
--   credits JSONB を work_requests に追加。
-- - 「登録して記録開始」フローでも管理画面の検証対象として
--   work_requests に approved 行を残す運用にするため、status に
--   'auto_approved' を追加（既存値はそのまま、CHECK 制約のみ拡張）。

-- ── movies テーブル拡張 ──────────────────────────────────────────────────
ALTER TABLE movies ADD COLUMN IF NOT EXISTS release_year_only BOOLEAN
  NOT NULL DEFAULT FALSE;

ALTER TABLE movies ADD COLUMN IF NOT EXISTS homepage TEXT;

-- 既存の data_source='user' 行で release_date が YYYY-01-01 のものは
-- 「年のみ入力」だった可能性が極めて高い（API 実装が year → YYYY-01-01 と
-- 自動補完していた歴史的経緯）。TMDB 由来データには触れない。
UPDATE movies
   SET release_year_only = TRUE
 WHERE data_source = 'user'
   AND release_date IS NOT NULL
   AND EXTRACT(MONTH FROM release_date) = 1
   AND EXTRACT(DAY   FROM release_date) = 1
   AND release_year_only = FALSE;


-- ── work_requests テーブル拡張 ──────────────────────────────────────────
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS homepage TEXT;

-- 正確な公開日（YYYY-MM-DD）が分かる場合の入力用。
-- year (INTEGER) は曖昧入力の互換用に残す。両方ある場合は release_date を優先。
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS release_date DATE;

-- 監督・キャスト候補。movies.credits と同じ {cast: [], crew: []} 形式で保持。
-- 承認時に movies.credits にコピーする。
ALTER TABLE work_requests ADD COLUMN IF NOT EXISTS credits JSONB
  NOT NULL DEFAULT '{"cast":[],"crew":[]}';

-- 「ユーザーが直接登録 → 検証待ち」用ステータス。
-- 既存の pending/approved/rejected/merged はそのまま。
ALTER TABLE work_requests DROP CONSTRAINT IF EXISTS work_requests_status_check;
ALTER TABLE work_requests ADD CONSTRAINT work_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'merged', 'auto_approved'));

-- 管理画面で auto_approved を素早く一覧できるように
CREATE INDEX IF NOT EXISTS idx_work_requests_auto_approved
  ON work_requests (created_at DESC)
  WHERE status = 'auto_approved';
