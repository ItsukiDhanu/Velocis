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
  owner_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  visibility ENUM('public', 'private') DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (owner_id, name),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  head_commit_id INT NULL,
  is_default TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (repo_id, name),
  FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE commits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  author_id INT NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_merge TINYINT(1) DEFAULT 0,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE commit_parents (
  commit_id INT NOT NULL,
  parent_commit_id INT NOT NULL,
  PRIMARY KEY (commit_id, parent_commit_id),
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE merges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_branch_id INT NOT NULL,
  target_branch_id INT NOT NULL,
  merge_commit_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (target_branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (merge_commit_id) REFERENCES commits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE rollback_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  from_commit_id INT NULL,
  to_commit_id INT NULL,
  actor_id INT NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (from_commit_id) REFERENCES commits(id) ON DELETE SET NULL,
  FOREIGN KEY (to_commit_id) REFERENCES commits(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
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
  UNIQUE (sha256)
) ENGINE=InnoDB;

CREATE TABLE repo_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  repo_id INT NOT NULL,
  path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (repo_id, path),
  FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE staging_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  uploader_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  blob_id INT NOT NULL,
  action ENUM('add', 'modify', 'delete') DEFAULT 'add',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blob_id) REFERENCES file_blobs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE commit_files (
  commit_id INT NOT NULL,
  file_id INT NOT NULL,
  blob_id INT NOT NULL,
  action ENUM('add', 'modify', 'delete') DEFAULT 'add',
  PRIMARY KEY (commit_id, file_id),
  FOREIGN KEY (commit_id) REFERENCES commits(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES repo_files(id) ON DELETE CASCADE,
  FOREIGN KEY (blob_id) REFERENCES file_blobs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
