-- ============================================
-- watchlists にUI側で使われている列を追加
-- ============================================
-- WorkDetail で書き込み/読み込みしているが初期スキーマに無く、
-- 詳細保存時にPostgRESTエラーで沈黙していたため追加。

-- 鑑賞日の概算モード ('exact' | 'old' | 'recent')
-- 'old'=ずっと前、'recent'=最近、'exact'=watched_at に正確な日付あり
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS watched_at_approx TEXT
  CHECK (watched_at_approx IN ('exact', 'old', 'recent'));

-- 配信プラットフォーム名（Netflix / Prime Video / U-NEXT 等の自由入力）
-- watch_method='streaming' のときに記録
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS streaming_platform TEXT;

-- Watchlist (want_to_watch) に付ける一言メモ／クリップメモ
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS memo TEXT;
