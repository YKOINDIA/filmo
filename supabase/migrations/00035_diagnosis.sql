-- ============================================
-- 映画好き診断: 診断タイプの保存
-- ============================================
-- /diagnosis で判定した「映画タイプ」をプロフィールに保存し、
-- バッジ表示・再診断の上書きに使う。タイプ id は
-- app/lib/diagnosis/types.ts の DIAGNOSIS_TYPES.id に対応する文字列。
-- 任意項目 (未診断は NULL)。映画偏差値は計算式ベースのため DB 列は持たない。

ALTER TABLE users ADD COLUMN IF NOT EXISTS diagnosis_type TEXT
  CHECK (diagnosis_type IS NULL OR char_length(diagnosis_type) <= 60);

ALTER TABLE users ADD COLUMN IF NOT EXISTS diagnosis_at TIMESTAMPTZ;
