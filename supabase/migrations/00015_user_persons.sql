-- ============================================
-- persons テーブルのユーザー登録対応
-- ============================================
-- TMDB に無い監督・俳優・脚本家をユーザーが登録できるようにする。
-- 作品 (movies) で既に運用している「負ID + data_source='user'」パターンを踏襲。

-- ── persons テーブル拡張 ────────────────────────────────────────────────
-- tmdb_id を nullable に。ユーザー登録は tmdb_id NULL + 負ID で識別。
ALTER TABLE persons ALTER COLUMN tmdb_id DROP NOT NULL;

-- data_source / is_verified / created_by を追加 (movies と同設計)
ALTER TABLE persons ADD COLUMN IF NOT EXISTS data_source TEXT
  NOT NULL DEFAULT 'tmdb'
  CHECK (data_source IN ('tmdb', 'user'));

ALTER TABLE persons ADD COLUMN IF NOT EXISTS is_verified BOOLEAN
  NOT NULL DEFAULT FALSE;

ALTER TABLE persons ADD COLUMN IF NOT EXISTS created_by UUID
  REFERENCES users(id) ON DELETE SET NULL;

-- 表示の充実: 原語名・公式サイト
ALTER TABLE persons ADD COLUMN IF NOT EXISTS original_name TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS homepage TEXT;

-- 既存 TMDB 由来データは検証済み扱いにする
UPDATE persons SET is_verified = TRUE WHERE data_source = 'tmdb' AND is_verified = FALSE;

-- 重複登録防止: 同じユーザーが同じ名前の人物を二重登録しないように
-- (case-insensitive 比較は API 側でも実施)
CREATE UNIQUE INDEX IF NOT EXISTS uq_persons_user_name
  ON persons (created_by, LOWER(name))
  WHERE data_source = 'user';

-- 検索の高速化用 (案件規模で問題になったら拡張)
CREATE INDEX IF NOT EXISTS idx_persons_data_source
  ON persons (data_source);


-- ── RLS ─────────────────────────────────────────────────────────────────
-- 既存は RLS なしだったが、サービスロール経由の読み書きだけだったので
-- ここで有効化しても影響なし。SELECT は誰でも可、書き込みは限定。
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS persons_select ON persons;
CREATE POLICY persons_select ON persons FOR SELECT
  USING (true);

-- 認証ユーザーは自分の data_source='user' 行のみ作成可能。
-- TMDB キャッシュの書き込みはサービスロール (RLS バイパス) で行う。
DROP POLICY IF EXISTS persons_insert ON persons;
CREATE POLICY persons_insert ON persons FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND data_source = 'user'
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS persons_update ON persons;
CREATE POLICY persons_update ON persons FOR UPDATE
  USING (
    data_source = 'user' AND auth.uid() = created_by
  )
  WITH CHECK (
    data_source = 'user' AND auth.uid() = created_by
  );

DROP POLICY IF EXISTS persons_delete ON persons;
CREATE POLICY persons_delete ON persons FOR DELETE
  USING (
    data_source = 'user' AND auth.uid() = created_by
  );


-- ── data_contributions: 'register_person' を許可 ───────────────────────
ALTER TABLE data_contributions
  DROP CONSTRAINT IF EXISTS data_contributions_contribution_type_check;

ALTER TABLE data_contributions
  ADD CONSTRAINT data_contributions_contribution_type_check
  CHECK (contribution_type IN (
    'register_work',
    'request_work',
    'edit_proposal',
    'person_proposal',
    'add_cast',
    'register_person'
  ));

-- 人物への参照を持てるように person_id を追加
ALTER TABLE data_contributions ADD COLUMN IF NOT EXISTS person_id INTEGER
  REFERENCES persons(id) ON DELETE SET NULL;


-- ── person_edit_proposals: ユーザー登録人物にも紐付けられるように ─────
-- 既存の person_id は persons(id) を参照しており、負ID 対応のために
-- 何もしなくて良い (INTEGER のままで負を許容)。CHECK 制約も無いため
-- 既存マイグレーションの修正は不要。
