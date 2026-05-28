CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  github_id VARCHAR(64) NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(512),
  profile_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE repositories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNIQUE NOT NULL,
  name VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  visibility ENUM('public', 'private') DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_owner_repo (owner_id, name),
  INDEX idx_repo_owner (owner_id),
  CONSTRAINT fk_repo_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  name VARCHAR(120) UNIQUE NOT NULL,
  head_commit_id INT NULL,
  is_default TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_repo_branch (repo_id, name),
  INDEX idx_branch_repo (repo_id),
  CONSTRAINT fk_branch_repo FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE commits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  branch_id INT NOT NULL,
  author_id INT NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_merge TINYINT(1) DEFAULT 0,
  INDEX idx_commit_repo (repo_id),
  INDEX idx_commit_branch (branch_id),
  CONSTRAINT fk_commit_repo FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
  CONSTRAINT fk_commit_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_commit_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE commit_parents (
  commit_id INT NOT NULL,
  parent_commit_id INT NOT NULL,
  PRIMARY KEY (commit_id, parent_commit_id),
  INDEX idx_parent_commit (parent_commit_id),
  CONSTRAINT fk_commit_parent_child FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE,
  CONSTRAINT fk_commit_parent_parent FOREIGN KEY (parent_commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE merges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  source_branch_id INT NOT NULL,
  target_branch_id INT NOT NULL,
  merge_commit_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_merge_repo (repo_id),
  CONSTRAINT fk_merge_repo FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
  CONSTRAINT fk_merge_source FOREIGN KEY (source_branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_merge_target FOREIGN KEY (target_branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_merge_commit FOREIGN KEY (merge_commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE rollback_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  from_commit_id INT NULL,
  to_commit_id INT NULL,
  actor_id INT NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rollback_branch (branch_id),
  CONSTRAINT fk_rollback_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_rollback_from FOREIGN KEY (from_commit_id) REFERENCES commits(id) ON DELETE SET NULL,
  CONSTRAINT fk_rollback_to FOREIGN KEY (to_commit_id) REFERENCES commits(id) ON DELETE SET NULL,
  CONSTRAINT fk_rollback_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE branches
  ADD CONSTRAINT fk_branch_head_commit FOREIGN KEY (head_commit_id) REFERENCES commits(id) ON DELETE SET NULL;

CREATE TABLE file_blobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sha256 CHAR(64) NOT NULL,
  size_bytes INT NOT NULL,
  content_type VARCHAR(255),
  content LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_blob_hash (sha256)
) ENGINE=InnoDB;

CREATE TABLE repo_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_repo_path (repo_id, path),
  INDEX idx_repo_files_repo (repo_id),
  CONSTRAINT fk_repo_files_repo FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE staging_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  branch_id INT NOT NULL,
  uploader_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  blob_id INT NOT NULL,
  action ENUM('add', 'modify', 'delete') DEFAULT 'add',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_staging_branch (branch_id),
  CONSTRAINT fk_staging_repo FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE,
  CONSTRAINT fk_staging_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  CONSTRAINT fk_staging_uploader FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_staging_blob FOREIGN KEY (blob_id) REFERENCES file_blobs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE commit_files (
  commit_id INT NOT NULL,
  file_id INT NOT NULL,
  blob_id INT NOT NULL,
  action ENUM('add', 'modify', 'delete') DEFAULT 'add',
  PRIMARY KEY (commit_id, file_id),
  INDEX idx_commit_files_file (file_id),
  CONSTRAINT fk_commit_files_commit FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE,
  CONSTRAINT fk_commit_files_file FOREIGN KEY (file_id) REFERENCES repo_files(id) ON DELETE CASCADE,
  CONSTRAINT fk_commit_files_blob FOREIGN KEY (blob_id) REFERENCES file_blobs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

