-- ============================================
-- 人物一覧 (監督・脚本家・俳優) の絞り込み検索対応
-- ============================================
-- - 俳優 (get_filmo_actors) を追加
-- - 監督・脚本家・俳優の3関数に
--     p_country     : ISO 3166-1 (例: 'JP', 'US')
--     p_movie_query : 映画タイトル部分一致
--   の絞り込みパラメータを追加
--
-- 性能メモ:
--   100K 規模の movies でも production_countries / credits は JSONB の
--   小さな配列なので LATERAL 展開で十分。重くなったら materialized view 化する。

-- 旧シグネチャを破棄してから差し替える (CREATE OR REPLACE はデフォルト値
-- 追加でも引数列が変わると失敗するため)
DROP FUNCTION IF EXISTS get_filmo_directors(int, int);
DROP FUNCTION IF EXISTS get_filmo_screenwriters(int, int);

CREATE OR REPLACE FUNCTION get_filmo_directors(
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0,
  p_country text DEFAULT NULL,
  p_movie_query text DEFAULT NULL
)
RETURNS TABLE (
  person_id int,
  name text,
  profile_path text,
  film_count bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    (crew->>'id')::int AS person_id,
    crew->>'name' AS name,
    crew->>'profile_path' AS profile_path,
    COUNT(DISTINCT m.id) AS film_count
  FROM movies m,
       LATERAL jsonb_array_elements(COALESCE(m.credits->'crew', '[]'::jsonb)) AS crew
  WHERE crew->>'job' = 'Director'
    AND crew->>'id' IS NOT NULL
    AND (
      p_country IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(m.production_countries, '[]'::jsonb)) c
        WHERE c->>'iso_3166_1' = p_country
      )
    )
    AND (
      p_movie_query IS NULL
      OR p_movie_query = ''
      OR m.title ILIKE '%' || p_movie_query || '%'
      OR COALESCE(m.original_title, '') ILIKE '%' || p_movie_query || '%'
    )
  GROUP BY person_id, name, profile_path
  ORDER BY film_count DESC, name
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_filmo_screenwriters(
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0,
  p_country text DEFAULT NULL,
  p_movie_query text DEFAULT NULL
)
RETURNS TABLE (
  person_id int,
  name text,
  profile_path text,
  film_count bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    (crew->>'id')::int AS person_id,
    crew->>'name' AS name,
    crew->>'profile_path' AS profile_path,
    COUNT(DISTINCT m.id) AS film_count
  FROM movies m,
       LATERAL jsonb_array_elements(COALESCE(m.credits->'crew', '[]'::jsonb)) AS crew
  WHERE crew->>'department' = 'Writing'
    AND crew->>'job' IN ('Screenplay', 'Writer', 'Story', 'Author', 'Novel')
    AND crew->>'id' IS NOT NULL
    AND (
      p_country IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(m.production_countries, '[]'::jsonb)) c
        WHERE c->>'iso_3166_1' = p_country
      )
    )
    AND (
      p_movie_query IS NULL
      OR p_movie_query = ''
      OR m.title ILIKE '%' || p_movie_query || '%'
      OR COALESCE(m.original_title, '') ILIKE '%' || p_movie_query || '%'
    )
  GROUP BY person_id, name, profile_path
  ORDER BY film_count DESC, name
  LIMIT p_limit OFFSET p_offset;
$$;

-- 俳優 (cast) は credits.cast から集計。
-- 役名(キャラクター)に出演順 (order) があるので、メイン級だけに絞ることも可能だが、
-- 出演本数で並べる用途なので order フィルタはかけない。
CREATE OR REPLACE FUNCTION get_filmo_actors(
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0,
  p_country text DEFAULT NULL,
  p_movie_query text DEFAULT NULL
)
RETURNS TABLE (
  person_id int,
  name text,
  profile_path text,
  film_count bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    (cast_member->>'id')::int AS person_id,
    cast_member->>'name' AS name,
    cast_member->>'profile_path' AS profile_path,
    COUNT(DISTINCT m.id) AS film_count
  FROM movies m,
       LATERAL jsonb_array_elements(COALESCE(m.credits->'cast', '[]'::jsonb)) AS cast_member
  WHERE cast_member->>'id' IS NOT NULL
    AND (
      p_country IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(m.production_countries, '[]'::jsonb)) c
        WHERE c->>'iso_3166_1' = p_country
      )
    )
    AND (
      p_movie_query IS NULL
      OR p_movie_query = ''
      OR m.title ILIKE '%' || p_movie_query || '%'
      OR COALESCE(m.original_title, '') ILIKE '%' || p_movie_query || '%'
    )
  GROUP BY person_id, name, profile_path
  ORDER BY film_count DESC, name
  LIMIT p_limit OFFSET p_offset;
$$;
