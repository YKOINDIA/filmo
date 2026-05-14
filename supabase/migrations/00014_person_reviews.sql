-- ============================================
-- person_reviews: 監督・俳優・脚本家など人物への
-- 星評価 + テキストレビュー (作品レビューの兄弟テーブル)
-- ============================================
-- 既存の reviews (movies用) と並行運用。
-- - score 0.5〜5.0 (半星刻み)
-- - 1 人 1 人物につき最大 1 レビュー (UNIQUE)
-- - 通報は既存 content_reports に 'person_review' を追加
-- - likes は person_review_likes として独立 (reviews.likes との衝突回避)

CREATE TABLE IF NOT EXISTS person_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- TMDB の person id。負ID = ユーザー登録人物 (後続PRで対応)。
  -- FK は張らない: TMDB id 直値運用 (movies と同じ思想)。
  person_id INTEGER NOT NULL,
  score NUMERIC(2,1) CHECK (score >= 0.5 AND score <= 5.0),
  body TEXT,
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 1 ユーザー 1 人物につき 1 レビュー (編集は UPDATE)
  UNIQUE (user_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_person_reviews_person
  ON person_reviews (person_id, created_at DESC)
  WHERE is_hidden = FALSE AND is_draft = FALSE;
CREATE INDEX IF NOT EXISTS idx_person_reviews_user
  ON person_reviews (user_id, created_at DESC);

-- updated_at 自動更新 (作品 reviews と同様の挙動を再現)
CREATE OR REPLACE FUNCTION trg_person_reviews_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS person_reviews_set_updated_at ON person_reviews;
CREATE TRIGGER person_reviews_set_updated_at
  BEFORE UPDATE ON person_reviews
  FOR EACH ROW EXECUTE FUNCTION trg_person_reviews_set_updated_at();

ALTER TABLE person_reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: 公開かつ非下書き、または自分自身のレビュー
CREATE POLICY person_reviews_select ON person_reviews FOR SELECT
  USING (
    (is_hidden = FALSE AND is_draft = FALSE)
    OR auth.uid() = user_id
  );

CREATE POLICY person_reviews_insert ON person_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY person_reviews_update ON person_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY person_reviews_delete ON person_reviews FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- person_review_likes
-- ============================================
CREATE TABLE IF NOT EXISTS person_review_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_review_id UUID NOT NULL REFERENCES person_reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, person_review_id)
);

CREATE INDEX IF NOT EXISTS idx_person_review_likes_review
  ON person_review_likes (person_review_id);
CREATE INDEX IF NOT EXISTS idx_person_review_likes_user
  ON person_review_likes (user_id);

ALTER TABLE person_review_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY person_review_likes_select ON person_review_likes FOR SELECT
  USING (true);

CREATE POLICY person_review_likes_insert ON person_review_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY person_review_likes_delete ON person_review_likes FOR DELETE
  USING (auth.uid() = user_id);

-- likes_count を非正規化保持 (作品 reviews と同じパターン:
-- アプリ側で増減を反映する。トリガでも良いが既存実装と合わせる)。


-- ============================================
-- content_reports: 'person_review' を通報対象に追加
-- ============================================
-- CHECK 制約を一度落として再作成。
-- 既存データは TEXT なので影響なし。
ALTER TABLE content_reports
  DROP CONSTRAINT IF EXISTS content_reports_target_type_check;

ALTER TABLE content_reports
  ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type IN ('review', 'list', 'user', 'person_review'));


-- ============================================
-- get_person_review_stats: 集計取得 RPC
-- ============================================
-- SSR で aggregateRating (avg, count) を 1 クエリで取れるようにする。
-- person_id を引数にとり、公開レビューのみ集計。
CREATE OR REPLACE FUNCTION get_person_review_stats(p_person_id INTEGER)
RETURNS TABLE (
  review_count BIGINT,
  avg_score NUMERIC
) LANGUAGE sql STABLE AS $$
  SELECT
    COUNT(*) AS review_count,
    ROUND(AVG(score)::numeric, 2) AS avg_score
  FROM person_reviews
  WHERE person_id = p_person_id
    AND is_hidden = FALSE
    AND is_draft = FALSE
    AND score IS NOT NULL;
$$;
