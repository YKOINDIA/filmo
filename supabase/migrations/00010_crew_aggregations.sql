-- ============================================
-- 監督・脚本家一覧ページ用の集計SQL関数
-- ============================================
-- movies.credits JSONB から監督/脚本家を抽出して
-- 作品数の多い順に返す。100K規模の movies テーブルでも
-- LATERAL jsonb_array_elements は GIN なしでもPL/SQL実行で
-- 数百ms以内に収まる想定。重くなったら materialized view 化する。

CREATE OR REPLACE FUNCTION get_filmo_directors(
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
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
  GROUP BY person_id, name, profile_path
  ORDER BY film_count DESC, name
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION get_filmo_screenwriters(
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
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
  GROUP BY person_id, name, profile_path
  ORDER BY film_count DESC, name
  LIMIT p_limit OFFSET p_offset;
$$;
