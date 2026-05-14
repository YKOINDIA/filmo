-- ============================================
-- 絵文字タイトル当てミニゲーム
-- ============================================
-- TMDB 人気上位作品のあらすじを LLM (Claude Haiku) で要約して絵文字3〜5個に変換し、
-- emoji_quizzes に事前生成・キャッシュする。
-- 1セッション=10問の記録チャレンジ型。個人ベスト/連勝は attempts/sessions から算出。

-- ============================================
-- emoji_quizzes: 出題プール (作品ごとに1行)
-- ============================================
CREATE TABLE IF NOT EXISTS emoji_quizzes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id         INTEGER NOT NULL,
  media_type      TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title           TEXT NOT NULL,
  emojis          TEXT[] NOT NULL,
  difficulty      SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  poster_path     TEXT,
  release_year    SMALLINT,
  genres          TEXT[],
  accepted_count  INTEGER NOT NULL DEFAULT 0,
  rejected_count  INTEGER NOT NULL DEFAULT 0,
  generated_by    TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS idx_emoji_quizzes_active_difficulty
  ON emoji_quizzes (is_active, difficulty);
CREATE INDEX IF NOT EXISTS idx_emoji_quizzes_random
  ON emoji_quizzes (is_active) WHERE is_active = TRUE;

-- ============================================
-- emoji_quiz_sessions: 1セッション (10問) の集計
-- ============================================
CREATE TABLE IF NOT EXISTS emoji_quiz_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  correct_count   SMALLINT NOT NULL DEFAULT 0,
  total_count     SMALLINT NOT NULL DEFAULT 10,
  total_time_ms   INTEGER NOT NULL DEFAULT 0,
  score           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emoji_quiz_sessions_user_created
  ON emoji_quiz_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emoji_quiz_sessions_score
  ON emoji_quiz_sessions (score DESC);

-- ============================================
-- emoji_quiz_attempts: 1問ごとの結果
-- ============================================
CREATE TABLE IF NOT EXISTS emoji_quiz_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES emoji_quiz_sessions(id) ON DELETE CASCADE,
  quiz_id         UUID NOT NULL REFERENCES emoji_quizzes(id) ON DELETE CASCADE,
  is_correct      BOOLEAN NOT NULL,
  hints_used      SMALLINT NOT NULL DEFAULT 0,
  time_ms         INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emoji_quiz_attempts_user_created
  ON emoji_quiz_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emoji_quiz_attempts_session
  ON emoji_quiz_attempts (session_id);
-- 同じ作品を短期間で連続出題しないために最近プレイ済みを除外する用途
CREATE INDEX IF NOT EXISTS idx_emoji_quiz_attempts_user_quiz
  ON emoji_quiz_attempts (user_id, quiz_id, created_at DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE emoji_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE emoji_quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emoji_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- emoji_quizzes: 認証済みユーザーは誰でも読める。書込みは service-role のみ (seed script / cron)
CREATE POLICY emoji_quizzes_select_active ON emoji_quizzes
  FOR SELECT USING (is_active = TRUE);

-- emoji_quiz_sessions: 自分のセッションのみ読み書き
CREATE POLICY emoji_quiz_sessions_select_own ON emoji_quiz_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY emoji_quiz_sessions_insert_own ON emoji_quiz_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY emoji_quiz_sessions_update_own ON emoji_quiz_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- emoji_quiz_attempts: 自分の試行のみ読み書き
CREATE POLICY emoji_quiz_attempts_select_own ON emoji_quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY emoji_quiz_attempts_insert_own ON emoji_quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
