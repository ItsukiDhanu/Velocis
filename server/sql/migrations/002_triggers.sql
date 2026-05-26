-- Migration 002: Add triggers
-- 1) Add a commit_count column to repositories and backfill current counts
ALTER TABLE repositories ADD COLUMN commit_count INT DEFAULT 0;

UPDATE repositories r
SET commit_count = (
  SELECT COUNT(*) FROM commits c WHERE c.repo_id = r.id
);

-- 2) Maintain commit_count via triggers
DROP TRIGGER IF EXISTS increment_repo_commit_count;
CREATE TRIGGER increment_repo_commit_count
AFTER INSERT ON commits
FOR EACH ROW
BEGIN
  UPDATE repositories SET commit_count = commit_count + 1 WHERE id = NEW.repo_id;
END;

DROP TRIGGER IF EXISTS decrement_repo_commit_count;
CREATE TRIGGER decrement_repo_commit_count
AFTER DELETE ON commits
FOR EACH ROW
BEGIN
  UPDATE repositories SET commit_count = GREATEST(0, IFNULL(commit_count,0) - 1) WHERE id = OLD.repo_id;
END;

-- 3) Ensure only one default branch per repository
DROP TRIGGER IF EXISTS branches_only_one_default_after_insert;
CREATE TRIGGER branches_only_one_default_after_insert
AFTER INSERT ON branches
FOR EACH ROW
BEGIN
  IF NEW.is_default = 1 THEN
    UPDATE branches SET is_default = 0 WHERE repo_id = NEW.repo_id AND id <> NEW.id;
  END IF;
END;

DROP TRIGGER IF EXISTS branches_only_one_default_after_update;
CREATE TRIGGER branches_only_one_default_after_update
AFTER UPDATE ON branches
FOR EACH ROW
BEGIN
  IF NEW.is_default = 1 THEN
    UPDATE branches SET is_default = 0 WHERE repo_id = NEW.repo_id AND id <> NEW.id;
  END IF;
END;

-- End of migration
