-- ============================================
-- お知らせのセグメントターゲティング
-- ============================================

-- announcement に segment_filter (JSONB) を追加
-- 例: {"country":"JP","birthDecade":"90s","minLevel":3}
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS segment_filter JSONB;

-- 後で「直近30日アクティブ」のような時系列軸を入れたい時に index 必要だが、
-- 当面は読み取り中心 + 件数も多くないので index なしで様子見。
