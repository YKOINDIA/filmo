-- ============================================
-- Storage RLS Policies (avatars / voice-reviews)
-- ============================================
-- バケット自体は Supabase Dashboard で作成済みの想定。
-- ここでは storage.objects に対する RLS ポリシーを定義する。
--
-- パス規約: `${user.id}/...` で各ユーザーの user.id プレフィックス配下に保存。
-- 例: avatars/0e8a.../1730000000000.webp
--
-- 不具合履歴:
--   Profile.tsx の avatar アップロードが
--   "new row violates row-level security policy" で失敗していた
--   (Storage RLS の INSERT ポリシーが設定されていなかったため)。

-- ── avatars バケット ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "avatars_read_all" ON storage.objects;
CREATE POLICY "avatars_read_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── voice-reviews バケット ───────────────────────────────────────────────
-- 1.0 では UI 無効化中だが、データ保護のためポリシーは設定しておく。
-- 1.1 で機能再有効化したら自動的に動く。
DROP POLICY IF EXISTS "voice_reviews_read_all" ON storage.objects;
CREATE POLICY "voice_reviews_read_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-reviews');

DROP POLICY IF EXISTS "voice_reviews_insert_own" ON storage.objects;
CREATE POLICY "voice_reviews_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-reviews'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "voice_reviews_delete_own" ON storage.objects;
CREATE POLICY "voice_reviews_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-reviews'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
