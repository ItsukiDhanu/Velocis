import express from "express";
import crypto from "crypto";
import multer from "multer";
import { pool, withTransaction } from "../db.js";

const router = express.Router();
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

async function loadRepo(repoId, userId, options = {}) {
  const allowPublic = options.allowPublic === true;
  const [rows] = await pool.query(
    "SELECT id, owner_id, name, description, visibility, created_at, " +
      "(owner_id = ?) AS is_owner " +
      "FROM repositories WHERE id = ?",
    [userId, repoId]
  );
  const repo = rows[0] || null;
  if (!repo) {
    return null;
  }
  const isOwner = repo.owner_id === userId;
  if (!isOwner && (!allowPublic || repo.visibility !== "public")) {
    return null;
  }
  return repo;
}

async function loadBranchForRepo(repoId, branchId) {
  const [rows] = await pool.query(
    "SELECT id, head_commit_id FROM branches WHERE id = ? AND repo_id = ?",
    [branchId, repoId]
  );
  return rows[0] || null;
}

async function getReachableCommitIds(repoId, headCommitIds) {
  const heads = Array.isArray(headCommitIds)
    ? headCommitIds.filter(Boolean)
    : [headCommitIds].filter(Boolean);

  if (heads.length === 0) {
    return { reachable: new Set(), parentRows: [] };
  }

  const [parentRows] = await pool.query(
    "SELECT cp.commit_id, cp.parent_commit_id " +
      "FROM commit_parents cp JOIN commits c ON c.id = cp.commit_id " +
      "WHERE c.repo_id = ?",
    [repoId]
  );

  const parentsByCommit = new Map();
  for (const row of parentRows) {
    if (!parentsByCommit.has(row.commit_id)) {
      parentsByCommit.set(row.commit_id, []);
    }
    parentsByCommit.get(row.commit_id).push(row.parent_commit_id);
  }

  const reachable = new Set();
  const stack = [...heads];

  while (stack.length > 0) {
    const commitId = stack.pop();
    if (!commitId || reachable.has(commitId)) {
      continue;
    }
    reachable.add(commitId);
    const parents = parentsByCommit.get(commitId) || [];
    for (const parentId of parents) {
      if (!reachable.has(parentId)) {
        stack.push(parentId);
      }
    }
  }

  return { reachable, parentRows };
}

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT r.id, r.name, r.description, r.visibility, r.created_at, " +
        "(SELECT COUNT(*) FROM branches b WHERE b.repo_id = r.id) AS branch_count, " +
        "(SELECT COUNT(*) FROM commits c WHERE c.repo_id = r.id) AS commit_count " +
        "FROM repositories r WHERE r.owner_id = ? ORDER BY r.created_at DESC",
      [req.user.id]
    );
    res.json({ repositories: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/public", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT r.id, r.name, r.description, r.visibility, r.created_at, " +
        "u.username AS owner_username, " +
        "(r.owner_id = ?) AS is_owner, " +
        "(SELECT COUNT(*) FROM branches b WHERE b.repo_id = r.id) AS branch_count, " +
        "(SELECT COUNT(*) FROM commits c WHERE c.repo_id = r.id) AS commit_count " +
        "FROM repositories r JOIN users u ON u.id = r.owner_id " +
        "WHERE r.visibility = 'public' " +
        "ORDER BY r.created_at DESC",
      [req.user.id]
    );
    res.json({ repositories: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const name = (req.body.name || "").trim();
    const description = (req.body.description || "").trim();
    const visibility = req.body.visibility === "private" ? "private" : "public";

    if (!name) {
      return res.status(400).json({ error: "Repository name is required" });
    }

    const result = await withTransaction(async (conn) => {
      const [insertRepo] = await conn.query(
        "INSERT INTO repositories (owner_id, name, description, visibility) VALUES (?, ?, ?, ?)",
        [req.user.id, name, description, visibility]
      );

      const repoId = insertRepo.insertId;

      const [insertBranch] = await conn.query(
        "INSERT INTO branches (repo_id, name, is_default) VALUES (?, ?, 1)",
        [repoId, "main"]
      );

      return {
        repoId,
        defaultBranchId: insertBranch.insertId
      };
    });

    const repo = await loadRepo(result.repoId, req.user.id);
    res.status(201).json({ repository: repo });
  } catch (error) {
    next(error);
  }
});

router.get("/:repoId", async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const repo = await loadRepo(repoId, req.user.id, { allowPublic: true });
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }
    res.json({ repository: repo });
  } catch (error) {
    next(error);
  }
});

router.get("/:repoId/files", async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const branchId = Number(req.query.branchId);

    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }

    const repo = await loadRepo(repoId, req.user.id, { allowPublic: true });
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const branch = await loadBranchForRepo(repoId, branchId);
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    if (!branch.head_commit_id) {
      return res.json({ files: [] });
    }

    const { reachable } = await getReachableCommitIds(repoId, branch.head_commit_id);
    const reachableCommitIds = Array.from(reachable);

    if (reachableCommitIds.length === 0) {
      return res.json({ files: [] });
    }

    const placeholders = reachableCommitIds.map(() => "?").join(", ");

    const [rows] = await pool.query(
      "SELECT rf.id AS file_id, rf.path AS file_path, cf.action, " +
        "c.id AS commit_id, c.message AS commit_message, c.created_at AS commit_created_at, " +
        "u.username AS author_username, b.size_bytes " +
        "FROM commits c " +
        "JOIN commit_files cf ON cf.commit_id = c.id " +
        "JOIN repo_files rf ON rf.id = cf.file_id " +
        "JOIN file_blobs b ON b.id = cf.blob_id " +
        "JOIN users u ON u.id = c.author_id " +
        `WHERE c.repo_id = ? AND c.id IN (${placeholders}) ` +
        "ORDER BY c.created_at DESC, c.id DESC",
      [repoId, ...reachableCommitIds]
    );

    const latestByFile = new Map();
    for (const row of rows) {
      if (!latestByFile.has(row.file_id)) {
        if (row.action !== "delete") {
          latestByFile.set(row.file_id, row);
        }
      }
    }

    res.json({ files: Array.from(latestByFile.values()) });
  } catch (error) {
    next(error);
  }
});

router.get("/:repoId/staging", async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const branchId = Number(req.query.branchId);

    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }

    const repo = await loadRepo(repoId, req.user.id);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const [rows] = await pool.query(
      "SELECT s.id, s.file_path, s.action, s.created_at, b.size_bytes, b.content_type " +
        "FROM staging_files s JOIN file_blobs b ON b.id = s.blob_id " +
        "WHERE s.repo_id = ? AND s.branch_id = ? ORDER BY s.created_at DESC",
      [repoId, branchId]
    );

    res.json({ files: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/:repoId/staging", upload.array("files"), async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const branchId = Number(req.body.branchId || req.query.branchId);
    const files = req.files || [];

    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }

    if (files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const repo = await loadRepo(repoId, req.user.id);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const branch = await loadBranchForRepo(repoId, branchId);
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    await withTransaction(async (conn) => {
      for (const file of files) {
        const filePath = file.originalname;
        const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");

        const [blobRows] = await conn.query(
          "SELECT id FROM file_blobs WHERE sha256 = ?",
          [hash]
        );

        let blobId = null;
        if (blobRows.length > 0) {
          blobId = blobRows[0].id;
        } else {
          const [insertBlob] = await conn.query(
            "INSERT INTO file_blobs (sha256, size_bytes, content_type, content) VALUES (?, ?, ?, ?)",
            [hash, file.size, file.mimetype, file.buffer]
          );
          blobId = insertBlob.insertId;
        }

        const [existingFileRows] = await conn.query(
          "SELECT id FROM repo_files WHERE repo_id = ? AND path = ?",
          [repoId, filePath]
        );

        const action = existingFileRows.length > 0 ? "modify" : "add";

        await conn.query(
          "DELETE FROM staging_files WHERE repo_id = ? AND branch_id = ? AND file_path = ?",
          [repoId, branchId, filePath]
        );

        await conn.query(
          "INSERT INTO staging_files (repo_id, branch_id, uploader_id, file_path, blob_id, action) VALUES (?, ?, ?, ?, ?, ?)",
          [repoId, branchId, req.user.id, filePath, blobId, action]
        );
      }
    });

    const [rows] = await pool.query(
      "SELECT s.id, s.file_path, s.action, s.created_at, b.size_bytes, b.content_type " +
        "FROM staging_files s JOIN file_blobs b ON b.id = s.blob_id " +
        "WHERE s.repo_id = ? AND s.branch_id = ? ORDER BY s.created_at DESC",
      [repoId, branchId]
    );

    res.status(201).json({ files: rows });
  } catch (error) {
    next(error);
  }
});

router.delete("/:repoId/staging/:stagingId", async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const stagingId = Number(req.params.stagingId);

    const repo = await loadRepo(repoId, req.user.id);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const [rows] = await pool.query(
      "SELECT id FROM staging_files WHERE id = ? AND repo_id = ?",
      [stagingId, repoId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Staged file not found" });
    }

    await pool.query("DELETE FROM staging_files WHERE id = ?", [stagingId]);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post("/:repoId/commit", async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const branchId = Number(req.body.branchId);
    const message = (req.body.message || "").trim();

    if (!branchId) {
      return res.status(400).json({ error: "branchId is required" });
    }

    if (!message) {
      return res.status(400).json({ error: "Commit message is required" });
    }

    const repo = await loadRepo(repoId, req.user.id);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const branch = await loadBranchForRepo(repoId, branchId);
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    const commitId = await withTransaction(async (conn) => {
      const [stagedRows] = await conn.query(
        "SELECT id, file_path, blob_id, action FROM staging_files WHERE repo_id = ? AND branch_id = ? ORDER BY created_at ASC",
        [repoId, branchId]
      );

      if (stagedRows.length === 0) {
        const error = new Error("No staged files to commit");
        error.status = 400;
        throw error;
      }

      const [insertCommit] = await conn.query(
        "INSERT INTO commits (repo_id, branch_id, author_id, message, is_merge) VALUES (?, ?, ?, ?, 0)",
        [repoId, branchId, req.user.id, message]
      );

      const newCommitId = insertCommit.insertId;

      if (branch.head_commit_id) {
        await conn.query(
          "INSERT INTO commit_parents (commit_id, parent_commit_id) VALUES (?, ?)",
          [newCommitId, branch.head_commit_id]
        );
      }

      const values = [];
      const placeholders = [];

      for (const staged of stagedRows) {
        const [fileInsert] = await conn.query(
          "INSERT INTO repo_files (repo_id, path) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
          [repoId, staged.file_path]
        );
        const fileId = fileInsert.insertId;
        placeholders.push("(?, ?, ?, ?)");
        values.push(newCommitId, fileId, staged.blob_id, staged.action);
      }

      await conn.query(
        `INSERT INTO commit_files (commit_id, file_id, blob_id, action) VALUES ${placeholders.join(", ")}`,
        values
      );

      await conn.query("UPDATE branches SET head_commit_id = ? WHERE id = ?", [
        newCommitId,
        branchId
      ]);

      await conn.query("DELETE FROM staging_files WHERE repo_id = ? AND branch_id = ?", [
        repoId,
        branchId
      ]);

      return newCommitId;
    });

    res.status(201).json({ commitId });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

router.delete("/:repoId", async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const repo = await loadRepo(repoId, req.user.id);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    await pool.query("DELETE FROM repositories WHERE id = ?", [repoId]);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/:repoId/branches", async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const repo = await loadRepo(repoId, req.user.id, { allowPublic: true });
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const [rows] = await pool.query(
      "SELECT b.id, b.name, b.head_commit_id, b.is_default, b.created_at, " +
        "c.message AS head_message, c.created_at AS head_created_at " +
        "FROM branches b " +
        "LEFT JOIN commits c ON c.id = b.head_commit_id " +
        "WHERE b.repo_id = ? ORDER BY b.is_default DESC, b.name ASC",
      [repoId]
    );

    res.json({ branches: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/:repoId/branches", async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const repo = await loadRepo(repoId, req.user.id);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const name = (req.body.name || "").trim();
    const fromBranchId = req.body.fromBranchId ? Number(req.body.fromBranchId) : null;
    const fromCommitId = req.body.fromCommitId ? Number(req.body.fromCommitId) : null;

    if (!name) {
      return res.status(400).json({ error: "Branch name is required" });
    }

    let baseCommitId = null;
    if (fromCommitId) {
      const [commitRows] = await pool.query(
        "SELECT id FROM commits WHERE id = ? AND repo_id = ?",
        [fromCommitId, repoId]
      );
      if (commitRows.length === 0) {
        return res.status(404).json({ error: "Commit not found" });
      }
      baseCommitId = fromCommitId;
    } else if (fromBranchId) {
      const [branchRows] = await pool.query(
        "SELECT head_commit_id FROM branches WHERE id = ? AND repo_id = ?",
        [fromBranchId, repoId]
      );
      if (branchRows.length === 0) {
        return res.status(404).json({ error: "Source branch not found" });
      }
      baseCommitId = branchRows[0].head_commit_id;
    } else {
      const [defaultRows] = await pool.query(
        "SELECT head_commit_id FROM branches WHERE repo_id = ? AND is_default = 1",
        [repoId]
      );
      baseCommitId = defaultRows.length ? defaultRows[0].head_commit_id : null;
    }

    const [insertBranch] = await pool.query(
      "INSERT INTO branches (repo_id, name, head_commit_id) VALUES (?, ?, ?)",
      [repoId, name, baseCommitId]
    );

    res.status(201).json({ branchId: insertBranch.insertId });
  } catch (error) {
    next(error);
  }
});

router.get("/:repoId/graph", async (req, res, next) => {
  try {
    const repoId = Number(req.params.repoId);
    const repo = await loadRepo(repoId, req.user.id, { allowPublic: true });
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    const [branches] = await pool.query(
      "SELECT id, name, head_commit_id, is_default FROM branches WHERE repo_id = ? ORDER BY is_default DESC, name ASC",
      [repoId]
    );

    const headCommitIds = branches
      .map((branch) => branch.head_commit_id)
      .filter(Boolean);

    if (headCommitIds.length === 0) {
      return res.json({ commits: [], parents: [], branches });
    }

    const { reachable, parentRows } = await getReachableCommitIds(repoId, headCommitIds);
    const reachableCommitIds = Array.from(reachable);

    if (reachableCommitIds.length === 0) {
      return res.json({ commits: [], parents: [], branches });
    }

    const placeholders = reachableCommitIds.map(() => "?").join(",");
    const [commits] = await pool.query(
      "SELECT c.id, c.repo_id, c.branch_id, c.author_id, c.message, c.created_at, c.is_merge, " +
        "u.username AS author_username, u.avatar_url AS author_avatar " +
        "FROM commits c JOIN users u ON u.id = c.author_id " +
        `WHERE c.repo_id = ? AND c.id IN (${placeholders}) ORDER BY c.created_at DESC`,
      [repoId, ...reachableCommitIds]
    );

    const parents = parentRows.filter(
      (row) => reachable.has(row.commit_id) && reachable.has(row.parent_commit_id)
    );

    res.json({ commits, parents, branches });
  } catch (error) {
    next(error);
  }
});

export default router;
