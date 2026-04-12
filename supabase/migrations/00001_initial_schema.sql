-- ============================================
-- Filmo - 映画・ドラマ・アニメレビューサービス
-- 初期スキーマ
-- ============================================

-- ユーザー
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  favorite_genres TEXT[] DEFAULT '{}',
  best_movie_id INTEGER,
  best_movie_title TEXT,
  best_movie_poster TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  points INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  notify_new_release BOOLEAN DEFAULT TRUE,
  notify_streaming BOOLEAN DEFAULT TRUE,
  notify_follow BOOLEAN DEFAULT TRUE,
  notify_like BOOLEAN DEFAULT TRUE,
  notify_community BOOLEAN DEFAULT TRUE,
  notify_email BOOLEAN DEFAULT FALSE,
  theme TEXT DEFAULT 'dark',
  login_streak INTEGER DEFAULT 0,
  last_login_date DATE,
  total_watch_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 映画キャッシュ（TMDB APIレスポンスキャッシュ）
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  tmdb_id INTEGER UNIQUE NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  release_date DATE,
  runtime INTEGER,
  vote_average NUMERIC(3,1),
  vote_count INTEGER,
  genres JSONB DEFAULT '[]',
  production_countries JSONB DEFAULT '[]',
  credits JSONB DEFAULT '{}',
  streaming_services JSONB DEFAULT '[]',
  media_type TEXT NOT NULL DEFAULT 'movie' CHECK (media_type IN ('movie', 'tv', 'anime')),
  number_of_seasons INTEGER,
  number_of_episodes INTEGER,
  status TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- エピソード（ドラマ・アニメ用）
CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT,
  overview TEXT,
  air_date DATE,
  runtime INTEGER,
  still_path TEXT,
  UNIQUE(movie_id, season_number, episode_number)
);

-- 鑑賞リスト（Mark! / Clip! / 観てる）
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('watched', 'want_to_watch', 'watching')),
  watched_at DATE,
  watch_method TEXT CHECK (watch_method IN ('theater', 'streaming', 'dvd', 'tv', 'other')),
  watch_method_detail TEXT,
  score NUMERIC(2,1) CHECK (score >= 0.5 AND score <= 5.0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, movie_id)
);

-- エピソード視聴状況
CREATE TABLE IF NOT EXISTS episode_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  watched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);

-- レビュー
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  score NUMERIC(2,1) CHECK (score >= 0.5 AND score <= 5.0),
  title TEXT,
  body TEXT,
  has_spoiler BOOLEAN DEFAULT FALSE,
  is_draft BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- いいね
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, review_id)
);

-- フォロー
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- 俳優
CREATE TABLE IF NOT EXISTS actors (
  id INTEGER PRIMARY KEY,
  tmdb_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  profile_path TEXT,
  biography TEXT,
  birthday DATE,
  place_of_birth TEXT,
  known_for JSONB DEFAULT '[]',
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- 監督
CREATE TABLE IF NOT EXISTS directors (
  id INTEGER PRIMARY KEY,
  tmdb_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  profile_path TEXT,
  biography TEXT,
  birthday DATE,
  place_of_birth TEXT,
  known_for JSONB DEFAULT '[]',
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fan!（お気に入り俳優・監督）
CREATE TABLE IF NOT EXISTS fans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  person_type TEXT NOT NULL CHECK (person_type IN ('actor', 'director')),
  person_id INTEGER NOT NULL,
  person_name TEXT NOT NULL,
  person_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, person_type, person_id)
);

-- 通知
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'new_follower', 'new_like', 'new_release', 'streaming_available',
    'theater_showing', 'fan_new_work', 'system', 'achievement'
  )),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 配信サービス
CREATE TABLE IF NOT EXISTS streaming_services (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  url TEXT,
  tmdb_provider_id INTEGER UNIQUE
);

-- 配信状況
CREATE TABLE IF NOT EXISTS streaming_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES streaming_services(id) ON DELETE CASCADE,
  availability_type TEXT NOT NULL CHECK (availability_type IN ('flatrate', 'rent', 'buy')),
  price NUMERIC(8,0),
  available_from DATE,
  available_until DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(movie_id, service_id, availability_type)
);

-- 上映スケジュール
CREATE TABLE IF NOT EXISTS theater_showings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  theater_name TEXT NOT NULL,
  theater_address TEXT,
  theater_lat NUMERIC(10,7),
  theater_lng NUMERIC(10,7),
  showtime TIMESTAMPTZ NOT NULL,
  screen TEXT,
  format TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TV放送スケジュール
CREATE TABLE IF NOT EXISTS tv_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
  broadcaster TEXT NOT NULL,
  air_date DATE NOT NULL,
  air_time TIME NOT NULL,
  episode_info TEXT,
  is_new BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- お知らせ（管理者→ユーザー）
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'important')),
  send_push BOOLEAN DEFAULT FALSE,
  send_email BOOLEAN DEFAULT FALSE,
  recipient_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, announcement_id)
);

-- レポート（不正報告）
CREATE TABLE IF NOT EXISTS review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- X投稿下書き
CREATE TABLE IF NOT EXISTS x_post_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 管理者アラート
CREATE TABLE IF NOT EXISTS admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  detail JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created ON admin_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_read ON admin_alerts(is_read);

-- アクセスログ
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  ip_hint TEXT,
  user_agent TEXT,
  action TEXT,
  record_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cron設定
CREATE TABLE IF NOT EXISTS cron_settings (
  path TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- キャンペーンクーポン
CREATE TABLE IF NOT EXISTS campaign_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  bonus_points INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 100,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- フィードバック
CREATE TABLE IF NOT EXISTS feedback_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT DEFAULT 'other' CHECK (category IN ('feature', 'bug', 'question', 'other')),
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  unread_admin BOOLEAN DEFAULT TRUE,
  unread_user BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES feedback_threads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ゲーミフィケーション テーブル
-- ============================================

-- ポイント履歴
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  detail JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id, created_at DESC);

-- レベル定義
CREATE TABLE IF NOT EXISTS user_levels (
  level INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  points_required INTEGER NOT NULL,
  color TEXT NOT NULL,
  icon TEXT
);

-- レベルマスターデータ挿入
INSERT INTO user_levels (level, title, points_required, color, icon) VALUES
  (1,  '映画初心者',         0,      '#888888', NULL),
  (5,  '映画好き',           500,    '#2ecc8a', NULL),
  (10, 'シネフィル',          2000,   '#3498db', NULL),
  (15, '映画通',             5000,   '#9b59b6', NULL),
  (20, '映画マニア',          8000,   '#e67e22', NULL),
  (25, 'シネマスター',        14000,  '#f0c040', NULL),
  (30, '映画の達人',          20000,  '#ff6b6b', NULL),
  (35, 'フィルムソムリエ',     35000,  '#e91e63', NULL),
  (40, 'シネマの神',          55000,  '#9c27b0', NULL),
  (45, '映画界の伝説',        75000,  '#673ab7', NULL),
  (50, '永遠のシネフィル',     100000, '#ff4444', NULL)
ON CONFLICT (level) DO NOTHING;

-- 称号
CREATE TABLE IF NOT EXISTS user_titles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('genre', 'streak', 'time', 'review', 'diversity', 'social', 'secret')),
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL,
  condition_detail JSONB DEFAULT '{}',
  icon TEXT,
  is_secret BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ユーザー取得称号
CREATE TABLE IF NOT EXISTS user_earned_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title_id TEXT REFERENCES user_titles(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title_id)
);

-- 称号マスターデータ
INSERT INTO user_titles (id, name, description, category, condition_type, condition_value, condition_detail, icon, is_secret) VALUES
  -- ジャンル系
  ('anime_god',       'アニオタ神',           'アニメを100本鑑賞',                   'genre', 'genre_count', 100, '{"genre_id": 16}', NULL, FALSE),
  ('horror_master',   '絶叫マシーン',          'ホラーを50本鑑賞',                    'genre', 'genre_count', 50,  '{"genre_id": 27}', NULL, FALSE),
  ('romance_guru',    '愛の伝道師',           '恋愛を80本鑑賞',                      'genre', 'genre_count', 80,  '{"genre_id": 10749}', NULL, FALSE),
  ('sf_prophet',      'SF預言者',             'SFを80本鑑賞',                        'genre', 'genre_count', 80,  '{"genre_id": 878}', NULL, FALSE),
  ('mystery_hunter',  'ミステリーハンター',     'サスペンスを60本鑑賞',                 'genre', 'genre_count', 60,  '{"genre_id": 9648}', NULL, FALSE),
  ('comedy_seeker',   '笑いの求道者',          'コメディを80本鑑賞',                   'genre', 'genre_count', 80,  '{"genre_id": 35}', NULL, FALSE),
  ('documentarist',   'ドキュメンタリスト',     'ドキュメンタリーを40本鑑賞',            'genre', 'genre_count', 40,  '{"genre_id": 99}', NULL, FALSE),
  ('musical_freak',   'ミュージカル狂',        'ミュージカルを30本鑑賞',               'genre', 'genre_count', 30,  '{"genre_id": 10402}', NULL, FALSE),
  -- 継続系
  ('year_ruler',      '不夜城の支配者',        '365日連続ログイン',                    'streak', 'login_streak', 365, '{}', NULL, FALSE),
  ('eternal_cinephile','永遠の映画人',          '500日連続ログイン',                    'streak', 'login_streak', 500, '{}', NULL, FALSE),
  ('hundred_samurai', '百日の侍',             '100日連続ログイン',                    'streak', 'login_streak', 100, '{}', NULL, FALSE),
  ('thirty_days',     '三日坊主卒業',          '30日連続ログイン',                     'streak', 'login_streak', 30,  '{}', NULL, FALSE),
  ('monthly_watcher', '月の鑑賞者',           '月30本×12ヶ月達成',                    'streak', 'monthly_30', 12,   '{}', NULL, FALSE),
  -- 時間帯系
  ('midnight_seeker', '深夜の求道者',          '深夜0-4時にレビュー50回',              'time', 'time_review', 50,   '{"hour_start": 0, "hour_end": 4}', NULL, FALSE),
  ('dawn_cinephile',  '夜明けのシネフィル',     '朝4-6時にレビュー30回',               'time', 'time_review', 30,   '{"hour_start": 4, "hour_end": 6}', NULL, FALSE),
  ('friday_king',     '金曜の夜の王',          '金曜夜21時以降にレビュー50回',          'time', 'time_review', 50,   '{"day": 5, "hour_start": 21}', NULL, FALSE),
  -- レビュー系
  ('long_critic',     '大長編評論家',          '1000文字超レビュー×20本',              'review', 'long_review', 20,   '{"min_chars": 1000}', NULL, FALSE),
  ('one_liner',       '一言居士',             '10文字以下レビュー×50本',              'review', 'short_review', 50,  '{"max_chars": 10}', NULL, FALSE),
  ('harsh_critic',    '辛口の匕首',           '評価1を30本',                         'review', 'score_count', 30,   '{"score": 1.0}', NULL, FALSE),
  ('saint',           '全肯定の聖人',          '評価5を100本',                        'review', 'score_count', 100,  '{"score": 5.0}', NULL, FALSE),
  ('philosopher',     '哲学者の独白',          '500文字以上レビュー×50本',             'review', 'long_review', 50,   '{"min_chars": 500}', NULL, FALSE),
  -- 多様性系
  ('world_traveler',  '世界一周シネフィル',     '50カ国以上の作品を鑑賞',               'diversity', 'country_count', 50, '{}', NULL, FALSE),
  ('classic_keeper',  '古典の番人',           '1980年以前の作品を50本鑑賞',           'diversity', 'classic_count', 50, '{"before_year": 1980}', NULL, FALSE),
  ('director_lover',  '監督の愛人',           '同一監督作品を15本以上鑑賞',            'diversity', 'director_count', 15, '{}', NULL, FALSE),
  -- ソーシャル系
  ('evangelist',      '映画布教師',           'フォロワー100人達成',                  'social', 'follower_count', 100, '{}', NULL, FALSE),
  ('love_giver',      '無償の愛',             'いいねを1000回送付',                   'social', 'likes_given', 1000,  '{}', NULL, FALSE),
  ('lone_cinephile',  '孤高のシネフィル',      'フォロワー0で200本鑑賞',               'social', 'lone_watcher', 200,  '{}', NULL, FALSE),
  -- シークレット系
  ('cursed_watcher',  '呪われた映画人',        '評価1を10本連続',                      'secret', 'consecutive_low', 10, '{}', NULL, TRUE),
  ('time_capsule',    'タイムカプセル',         '10年前公開作品を50本鑑賞',             'secret', 'old_movie', 50,     '{"years_ago": 10}', NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 月間ボーナス（重複防止）
CREATE TABLE IF NOT EXISTS monthly_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  bonus_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year_month, bonus_type)
);

-- いいね送信数トラッキング（日次上限用）
CREATE TABLE IF NOT EXISTS daily_like_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- ============================================
-- インデックス
-- ============================================
CREATE INDEX IF NOT EXISTS idx_watchlists_user ON watchlists(user_id, status);
CREATE INDEX IF NOT EXISTS idx_watchlists_movie ON watchlists(movie_id);
CREATE INDEX IF NOT EXISTS idx_reviews_movie ON reviews(movie_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_review ON likes(review_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_fans_user ON fans(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streaming_movie ON streaming_availability(movie_id);
CREATE INDEX IF NOT EXISTS idx_episodes_movie ON episodes(movie_id);
CREATE INDEX IF NOT EXISTS idx_episode_watches_user ON episode_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(media_type);
CREATE INDEX IF NOT EXISTS idx_movies_tmdb ON movies(tmdb_id);

-- ============================================
-- RPC: ポイント加算
-- ============================================
CREATE OR REPLACE FUNCTION increment_points(uid UUID, pts INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET points = points + pts, updated_at = NOW() WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS ポリシー
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE fans ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_earned_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_like_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE episode_watches ENABLE ROW LEVEL SECURITY;

-- users: 自分のデータのみ更新可、プロフィールは公開
CREATE POLICY users_select ON users FOR SELECT USING (true);
CREATE POLICY users_update ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- watchlists: 自分のみ
CREATE POLICY watchlists_select ON watchlists FOR SELECT USING (true);
CREATE POLICY watchlists_insert ON watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY watchlists_update ON watchlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY watchlists_delete ON watchlists FOR DELETE USING (auth.uid() = user_id);

-- reviews: 公開読み取り、自分のみ書き込み
CREATE POLICY reviews_select ON reviews FOR SELECT USING (is_hidden = FALSE OR auth.uid() = user_id);
CREATE POLICY reviews_insert ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY reviews_update ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY reviews_delete ON reviews FOR DELETE USING (auth.uid() = user_id);

-- likes
CREATE POLICY likes_select ON likes FOR SELECT USING (true);
CREATE POLICY likes_insert ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY likes_delete ON likes FOR DELETE USING (auth.uid() = user_id);

-- follows
CREATE POLICY follows_select ON follows FOR SELECT USING (true);
CREATE POLICY follows_insert ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY follows_delete ON follows FOR DELETE USING (auth.uid() = follower_id);

-- fans
CREATE POLICY fans_select ON fans FOR SELECT USING (true);
CREATE POLICY fans_insert ON fans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY fans_delete ON fans FOR DELETE USING (auth.uid() = user_id);

-- notifications: 自分のみ
CREATE POLICY notifications_select ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- feedback
CREATE POLICY feedback_threads_select ON feedback_threads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY feedback_threads_insert ON feedback_threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY feedback_messages_select ON feedback_messages FOR SELECT USING (true);
CREATE POLICY feedback_messages_insert ON feedback_messages FOR INSERT WITH CHECK (true);

-- points
CREATE POLICY user_points_select ON user_points FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_points_insert ON user_points FOR INSERT WITH CHECK (true);

-- titles
CREATE POLICY user_earned_titles_select ON user_earned_titles FOR SELECT USING (true);
CREATE POLICY user_earned_titles_insert ON user_earned_titles FOR INSERT WITH CHECK (true);

-- daily likes
CREATE POLICY daily_like_counts_all ON daily_like_counts FOR ALL USING (auth.uid() = user_id);

-- episode watches
CREATE POLICY episode_watches_select ON episode_watches FOR SELECT USING (true);
CREATE POLICY episode_watches_insert ON episode_watches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY episode_watches_delete ON episode_watches FOR DELETE USING (auth.uid() = user_id);

-- 初期配信サービスデータ
INSERT INTO streaming_services (name, logo_url, tmdb_provider_id) VALUES
  ('Netflix',     '/logos/netflix.svg',    8),
  ('Amazon Prime Video', '/logos/prime.svg', 9),
  ('Disney+',    '/logos/disney.svg',     337),
  ('U-NEXT',     '/logos/unext.svg',      84),
  ('Hulu',       '/logos/hulu.svg',       15),
  ('Apple TV+',  '/logos/apple.svg',      350),
  ('dアニメストア', '/logos/danime.svg',    430),
  ('ABEMA',      '/logos/abema.svg',      397),
  ('FOD',        '/logos/fod.svg',        263),
  ('Lemino',     '/logos/lemino.svg',     488),
  ('WOWOWオンデマンド', '/logos/wowow.svg', 24)
ON CONFLICT (name) DO NOTHING;

-- Cron設定の初期データ
INSERT INTO cron_settings (path, enabled) VALUES
  ('daily-x-post', TRUE),
  ('check-anomaly', TRUE),
  ('sync-streaming', TRUE)
ON CONFLICT (path) DO NOTHING;
