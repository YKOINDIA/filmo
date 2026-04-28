-- ============================================
-- キュレーションリスト基盤
-- 「Filmo編集部おすすめ」のリストを system user で持つ。
-- 実体は通常の user_lists / list_items を使い、is_curated フラグで識別。
-- ============================================

-- is_curated 列を追加 (検索高速化のためデノーマライズ)
ALTER TABLE user_lists ADD COLUMN IF NOT EXISTS is_curated BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_user_lists_is_curated ON user_lists(is_curated) WHERE is_curated = TRUE;

-- system user (auth.users 経由で挿入する必要があるが、CASCADE 制約があるので
-- auth.users にも同じ ID で挿入。Supabase ダッシュボードでこの ID のユーザーは
-- 削除しないこと。)
--
-- 実運用では Supabase Admin API で auth.users を作成してから users にプロフィールを
-- 入れるのが安全だが、ここでは migration として両方をINSERTする。
-- (Supabase の auth.users はテーブルなので普通に INSERT 可能)

-- 1. auth.users にシステムユーザーを挿入 (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000001') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'editorial@filmo.me',
      crypt('NOT_LOGGABLE_' || gen_random_uuid()::text, gen_salt('bf')), -- ログイン不可の長文パスワード
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"system","providers":["system"]}'::jsonb,
      '{"name":"Filmo編集部"}'::jsonb
    );
  END IF;
END $$;

-- 2. public.users にプロフィールを挿入 (idempotent)
INSERT INTO users (id, email, name, bio, avatar_url, level, points)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'editorial@filmo.me',
  'Filmo編集部',
  '映画好きのスタッフが厳選したテーマ別リストをお届けします',
  NULL,
  99,
  0
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  bio = EXCLUDED.bio;
