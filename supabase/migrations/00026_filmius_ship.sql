-- ============================================
-- FILMIUS 機体タイプ (STANDARD / SCOUT / HEAVY)
-- ============================================
-- 開始前に選んだ機体を session に記録。リーダーボード / 戦績 RPC の集計軸は
-- 今のところ難易度のみのまま (機体での分割はしない) で、ship は分析用。
-- 既存セッションは all 'standard' 扱い (DEFAULT)。

ALTER TABLE filmius_sessions
  ADD COLUMN IF NOT EXISTS ship TEXT NOT NULL DEFAULT 'standard'
    CHECK (ship IN ('standard','scout','heavy'));
