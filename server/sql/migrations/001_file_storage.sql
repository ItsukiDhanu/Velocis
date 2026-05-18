CREATE TABLE IF NOT EXISTS file_blobs (
	id INT AUTO_INCREMENT PRIMARY KEY,
	sha256 CHAR(64) NOT NULL,
	size_bytes INT NOT NULL,
	content_type VARCHAR(255),
	content LONGBLOB NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE KEY uniq_blob_hash (sha256)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS repo_files (
	id INT AUTO_INCREMENT PRIMARY KEY,
	repo_id INT NOT NULL,
	path VARCHAR(500) NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE KEY uniq_repo_path (repo_id, path),
	INDEX idx_repo_files_repo (repo_id),
	CONSTRAINT fk_repo_files_repo FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS staging_files (
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

CREATE TABLE IF NOT EXISTS commit_files (
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
