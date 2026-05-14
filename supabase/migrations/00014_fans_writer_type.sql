-- fans.person_type に 'writer' を追加（脚本家を Fan! 登録できるように）
ALTER TABLE fans DROP CONSTRAINT IF EXISTS fans_person_type_check;
ALTER TABLE fans ADD CONSTRAINT fans_person_type_check
  CHECK (person_type IN ('actor', 'director', 'writer'));
