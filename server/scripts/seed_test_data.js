import "../src/env.js";
import crypto from "crypto";
import { pool, withTransaction } from "../src/db.js";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function createUser(conn, i) {
  const githubId = `seed${i}`;
  const username = `user${i}`;
  const avatar = `https://example.com/avatars/${i}.png`;
  const profile = `https://github.com/${username}`;

  const [res] = await conn.query(
    "INSERT INTO users (github_id, username, avatar_url, profile_url) VALUES (?, ?, ?, ?)",
    [githubId, username, avatar, profile]
  );
  return res.insertId;
}

async function seed() {
  console.log("Starting seed: this will create ~100 users and many rows. Configure DB in server/.env before running.");

  for (let i = 1; i <= 100; i++) {
    try {
      await withTransaction(async (conn) => {
        const userId = await createUser(conn, i);

        const repoCount = randInt(2, 3);
        for (let r = 1; r <= repoCount; r++) {
          const repoName = `user${i}-repo${r}`;
          const [insertRepo] = await conn.query(
            "INSERT INTO repositories (owner_id, name, description, visibility) VALUES (?, ?, ?, ?)",
            [userId, repoName, `Seed repo ${repoName}`, "public"]
          );
          const repoId = insertRepo.insertId;

          // create default branch main
          const [insertBranch] = await conn.query(
            "INSERT INTO branches (repo_id, name, is_default) VALUES (?, ?, 1)",
            [repoId, "main"]
          );
          const mainBranchId = insertBranch.insertId;

          // optionally create 1-2 extra branches
          const extraBranches = randInt(1, 2);
          const branchIds = [mainBranchId];
          for (let b = 0; b < extraBranches; b++) {
            const bName = `feature-${b + 1}`;
            const [ib] = await conn.query(
              "INSERT INTO branches (repo_id, name) VALUES (?, ?)",
              [repoId, bName]
            );
            branchIds.push(ib.insertId);
          }

          // create some commits per branch
          for (const branchId of branchIds) {
            let lastCommitId = null;
            const commitCount = randInt(3, 6);
            for (let c = 0; c < commitCount; c++) {
              const message = `Seed commit ${c + 1} on branch ${branchId}`;
              const [insertCommit] = await conn.query(
                "INSERT INTO commits (repo_id, branch_id, author_id, message, is_merge) VALUES (?, ?, ?, ?, 0)",
                [repoId, branchId, userId, message]
              );
              const newCommitId = insertCommit.insertId;

              if (lastCommitId) {
                await conn.query(
                  "INSERT INTO commit_parents (commit_id, parent_commit_id) VALUES (?, ?)",
                  [newCommitId, lastCommitId]
                );
              }

              // create a file blob
              const content = `File content for ${repoName} ${branchId} commit ${c + 1}`;
              const hash = sha256Hex(content);
              const [blobRows] = await conn.query("SELECT id FROM file_blobs WHERE sha256 = ?", [hash]);
              let blobId;
              if (blobRows.length > 0) {
                blobId = blobRows[0].id;
              } else {
                const [ib] = await conn.query(
                  "INSERT INTO file_blobs (sha256, size_bytes, content_type, content) VALUES (?, ?, ?, ?)",
                  [hash, Buffer.byteLength(content), "text/plain", Buffer.from(content)]
                );
                blobId = ib.insertId;
              }

              // upsert repo_file
              const filePath = `file-${c + 1}.txt`;
              const [fileInsert] = await conn.query(
                "INSERT INTO repo_files (repo_id, path) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
                [repoId, filePath]
              );
              const fileId = fileInsert.insertId;

              // attach file to commit
              await conn.query(
                "INSERT INTO commit_files (commit_id, file_id, blob_id, action) VALUES (?, ?, ?, ?)",
                [newCommitId, fileId, blobId, "add"]
              );

              // update branch head
              await conn.query("UPDATE branches SET head_commit_id = ? WHERE id = ?", [newCommitId, branchId]);

              lastCommitId = newCommitId;
            }
          }
        }
      });
      if (i % 10 === 0) console.log(`Created ${i} users...`);
    } catch (err) {
      console.error(`Error seeding user ${i}:`, err.message || err);
    }
  }

  console.log("Seeding complete.");
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
