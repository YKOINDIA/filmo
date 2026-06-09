-- ============================================
-- Filmo ファスティング (断食をゲーム感覚で続けるコミュニティ)
-- ============================================
-- コンセプト: 「孤独なファスティングを、仲間とゲーム感覚で乗り越える」
--
-- Agey (00027) は本人のみ RLS の「個人メモ」だったが、ファスティングは
-- コミュニティ型。「いま一緒に頑張っている仲間」を見せるため、
-- セッション・回復食投稿・応援はすべて公開 SELECT、書き込みは本人のみ。
--
-- 100K+ ユーザー想定。同時実行ユーザー数の集計・タイムライン取得が
-- 高頻度で走るため、用途別の部分インデックスを張る。
-- リアルタイムはクライアント側ポーリングで賄う (Realtime 購読は使わない)。

-- ============================================
-- fasting_sessions: 1 回のファスティング (開始〜終了)
-- ============================================
CREATE TABLE IF NOT EXISTS fasting_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 開始時刻。経過時間はこの絶対時刻から算出するためバックグラウンドでも正確。
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 目標時間 (h)。16h / 24h など。1〜168 (1 週間) まで。
  target_hours  SMALLINT NOT NULL DEFAULT 16 CHECK (target_hours BETWEEN 1 AND 168),
  -- 終了時刻。NULL = 実行中。
  ended_at      TIMESTAMPTZ,
  -- 終了種別: completed = 目標達成 / stopped = 途中終了・中止。実行中は NULL。
  result        TEXT CHECK (result IS NULL OR result IN ('completed', 'stopped')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1 ユーザーにつき実行中セッションは 1 つだけ。
CREATE UNIQUE INDEX IF NOT EXISTS uq_fasting_active_one
  ON fasting_sessions (user_id) WHERE ended_at IS NULL;

-- 同時実行ユーザー数の集計 (ended_at IS NULL の件数) を高速化。
CREATE INDEX IF NOT EXISTS idx_fasting_active
  ON fasting_sessions (started_at DESC) WHERE ended_at IS NULL;

-- 終了タイムラインフィード (新しく終わった順)。
CREATE INDEX IF NOT EXISTS idx_fasting_ended
  ON fasting_sessions (ended_at DESC) WHERE ended_at IS NOT NULL;

-- ユーザー個人の履歴 (累計時間・ストリーク計算用)。
CREATE INDEX IF NOT EXISTS idx_fasting_user
  ON fasting_sessions (user_id, started_at DESC);

-- ============================================
-- fasting_posts: 終了後の「回復食」シェア
-- ============================================
CREATE TABLE IF NOT EXISTS fasting_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- どのセッションの回復食か (任意)。セッション削除時は投稿は残す。
  session_id    UUID REFERENCES fasting_sessions(id) ON DELETE SET NULL,
  -- 食事内容のテキスト。最大 500 文字。
  body          TEXT CHECK (body IS NULL OR char_length(body) <= 500),
  -- 写真 URL (1 枚)。フロントで WebP に圧縮・リサイズ済みのものを storage に保存。
  photo_url     TEXT CHECK (photo_url IS NULL OR char_length(photo_url) <= 500),
  -- 達成したファスティング時間のスナップショット (h)。称えあい表示用。
  fasted_hours  NUMERIC(6,2) CHECK (fasted_hours IS NULL OR fasted_hours >= 0),
  -- 応援数の非正規化カウンタ (一覧で N+1 を避けるためトリガで保守)。
  cheer_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 回復食タイムライン (新着順)。
CREATE INDEX IF NOT EXISTS idx_fasting_posts_recent
  ON fasting_posts (created_at DESC);

-- 自分の投稿数集計用。
CREATE INDEX IF NOT EXISTS idx_fasting_posts_user
  ON fasting_posts (user_id, created_at DESC);

-- ============================================
-- fasting_cheers: 投稿への応援 (いいね・スタンプ)
-- ============================================
CREATE TABLE IF NOT EXISTS fasting_cheers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES fasting_posts(id) ON DELETE CASCADE,
  -- スタンプの絵文字 (👏 🔥 💪 など)。1 投稿 1 ユーザー 1 つ (差し替え可)。
  stamp       TEXT NOT NULL DEFAULT '👏' CHECK (char_length(stamp) BETWEEN 1 AND 8),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_fasting_cheers_post
  ON fasting_cheers (post_id);

-- ── cheer_count を保守するトリガ ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION fasting_cheers_count_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE fasting_posts SET cheer_count = cheer_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE fasting_posts SET cheer_count = GREATEST(0, cheer_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fasting_cheers_count ON fasting_cheers;
CREATE TRIGGER trg_fasting_cheers_count
  AFTER INSERT OR DELETE ON fasting_cheers
  FOR EACH ROW EXECUTE FUNCTION fasting_cheers_count_sync();

-- ============================================
-- RLS — 公開 SELECT / 書き込みは本人のみ
-- ============================================
ALTER TABLE fasting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fasting_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fasting_cheers   ENABLE ROW LEVEL SECURITY;

-- ── fasting_sessions ──
DROP POLICY IF EXISTS fasting_sessions_select_all ON fasting_sessions;
CREATE POLICY fasting_sessions_select_all ON fasting_sessions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS fasting_sessions_insert_own ON fasting_sessions;
CREATE POLICY fasting_sessions_insert_own ON fasting_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_sessions_update_own ON fasting_sessions;
CREATE POLICY fasting_sessions_update_own ON fasting_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_sessions_delete_own ON fasting_sessions;
CREATE POLICY fasting_sessions_delete_own ON fasting_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ── fasting_posts ──
DROP POLICY IF EXISTS fasting_posts_select_all ON fasting_posts;
CREATE POLICY fasting_posts_select_all ON fasting_posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS fasting_posts_insert_own ON fasting_posts;
CREATE POLICY fasting_posts_insert_own ON fasting_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_posts_update_own ON fasting_posts;
CREATE POLICY fasting_posts_update_own ON fasting_posts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_posts_delete_own ON fasting_posts;
CREATE POLICY fasting_posts_delete_own ON fasting_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ── fasting_cheers ──
DROP POLICY IF EXISTS fasting_cheers_select_all ON fasting_cheers;
CREATE POLICY fasting_cheers_select_all ON fasting_cheers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS fasting_cheers_insert_own ON fasting_cheers;
CREATE POLICY fasting_cheers_insert_own ON fasting_cheers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fasting_cheers_delete_own ON fasting_cheers;
CREATE POLICY fasting_cheers_delete_own ON fasting_cheers
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Storage: 回復食の写真バケット (fasting)
-- ============================================
-- バケット 'fasting' は Supabase Dashboard で「Public」で作成しておくこと
-- (avatars と同じ運用)。パス規約は `${user.id}/...webp`。
DROP POLICY IF EXISTS "fasting_read_all" ON storage.objects;
CREATE POLICY "fasting_read_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fasting');

DROP POLICY IF EXISTS "fasting_insert_own" ON storage.objects;
CREATE POLICY "fasting_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'fasting'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "fasting_update_own" ON storage.objects;
CREATE POLICY "fasting_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'fasting'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "fasting_delete_own" ON storage.objects;
CREATE POLICY "fasting_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'fasting'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
