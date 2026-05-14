-- レビューに「誰と見たか」のコンテキストを追加
-- 'solo' (一人) / 'family' (家族) / 'couple' (カップル) / 'friends' (友人)
-- 既存レビューは NULL のまま残り、未指定として扱う
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS watch_context TEXT
  CHECK (watch_context IS NULL OR watch_context IN ('solo', 'family', 'couple', 'friends'));

-- 作品ごとの watch_context 分布を集計するための部分インデックス
-- 100K+ ユーザー想定で、watch_context が NULL の行は集計対象外なので除外
CREATE INDEX IF NOT EXISTS idx_reviews_movie_watch_context
  ON reviews(movie_id, watch_context)
  WHERE watch_context IS NOT NULL;
