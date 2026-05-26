import express from "express";
import { pool, withTransaction } from "../db.js";

const router = express.Router();

async function loadBranch(branchId, userId, options = {}) {
  const requireOwner = options.requireOwner !== false;
  const [rows] = await pool.query(
    "SELECT b.id, b.repo_id, b.name, b.head_commit_id, r.owner_id, r.visibility " +
      "FROM branches b JOIN repositories r ON r.id = b.repo_id WHERE b.id = ?",
    [branchId]
  );

  if (rows.length === 0) {
    return null;
  }

  const branch = rows[0];
  const isOwner = branch.owner_id === userId;

  if (requireOwner && !isOwner) {
    return null;
  }

  if (!requireOwner && !isOwner && branch.visibility !== "public") {
    return null;
  }

  return { ...branch, is_owner: isOwner };
}

async function getReachableCommitIds(repoId, headCommitId) {
  if (!headCommitId) {
    return new Set();
  }

  const [parentRows] = await pool.query(
    "SELECT cp.commit_id, cp.parent_commit_id " +
      "FROM commit_parents cp JOIN commits c ON c.id = cp.commit_id " +
      "JOIN branches b ON b.id = c.branch_id " +
      "WHERE b.repo_id = ?",
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
  const stack = [headCommitId];

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

  return reachable;
}

router.get("/:branchId/commits", async (req, res, next) => {
  try {
    const branchId = Number(req.params.branchId);
    const branch = await loadBranch(branchId, req.user.id, { requireOwner: false });
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    if (!branch.head_commit_id) {
      return res.json({ commits: [], branch });
    }

    const reachable = await getReachableCommitIds(branch.repo_id, branch.head_commit_id);
    const reachableCommitIds = Array.from(reachable);

    if (reachableCommitIds.length === 0) {
      return res.json({ commits: [], branch });
    }

    const placeholders = reachableCommitIds.map(() => "?").join(",");
    const [rows] = await pool.query(
      "SELECT c.id, c.message, c.created_at, c.is_merge, u.username, u.avatar_url " +
        "FROM commits c JOIN users u ON u.id = c.author_id " +
        "JOIN branches b ON b.id = c.branch_id " +
        `WHERE b.repo_id = ? AND c.id IN (${placeholders}) ORDER BY c.created_at DESC, c.id DESC`,
      [branch.repo_id, ...reachableCommitIds]
    );

    res.json({ commits: rows, branch });
  } catch (error) {
    next(error);
  }
});

router.post("/:branchId/commits", async (req, res, next) => {
  try {
    const branchId = Number(req.params.branchId);
    const branch = await loadBranch(branchId, req.user.id, { requireOwner: true });
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    const message = (req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Commit message is required" });
    }

    let parentCommitIds = Array.isArray(req.body.parentCommitIds)
      ? req.body.parentCommitIds.map((id) => Number(id))
      : [];

    if (parentCommitIds.length === 0 && branch.head_commit_id) {
      parentCommitIds = [branch.head_commit_id];
    }

    parentCommitIds = Array.from(
      new Set(parentCommitIds.filter((id) => Number.isFinite(id) && id > 0))
    );

    if (parentCommitIds.length > 0) {
      const placeholders = parentCommitIds.map(() => "?").join(",");
      const [rows] = await pool.query(
        `SELECT c.id FROM commits c JOIN branches b ON b.id = c.branch_id WHERE c.id IN (${placeholders}) AND b.repo_id = ?`,
        [...parentCommitIds, branch.repo_id]
      );
      if (rows.length !== parentCommitIds.length) {
        return res.status(400).json({ error: "Invalid parent commit reference" });
      }
    }

    const commitId = await withTransaction(async (conn) => {
      const [insertCommit] = await conn.query(
        "INSERT INTO commits (branch_id, author_id, message, is_merge) VALUES (?, ?, ?, ?)",
        [branch.id, req.user.id, message, parentCommitIds.length > 1 ? 1 : 0]
      );

      const newCommitId = insertCommit.insertId;

      if (parentCommitIds.length > 0) {
        const values = [];
        const placeholders = parentCommitIds
          .map((parentId) => {
            values.push(newCommitId, parentId);
            return "(?, ?)";
          })
          .join(",");

        await conn.query(
          `INSERT INTO commit_parents (commit_id, parent_commit_id) VALUES ${placeholders}`,
          values
        );
      }

      await conn.query("UPDATE branches SET head_commit_id = ? WHERE id = ?", [
        newCommitId,
        branch.id
      ]);

      return newCommitId;
    });

    res.status(201).json({ commitId });
  } catch (error) {
    next(error);
  }
});

router.post("/:branchId/merge", async (req, res, next) => {
  try {
    const branchId = Number(req.params.branchId);
    const targetBranch = await loadBranch(branchId, req.user.id, { requireOwner: true });
    if (!targetBranch) {
      return res.status(404).json({ error: "Target branch not found" });
    }

    const sourceBranchId = Number(req.body.sourceBranchId);
    const message = (req.body.message || "Merge branches").trim();

    if (!sourceBranchId) {
      return res.status(400).json({ error: "Source branch is required" });
    }

    const sourceBranch = await loadBranch(sourceBranchId, req.user.id, { requireOwner: true });
    if (!sourceBranch || sourceBranch.repo_id !== targetBranch.repo_id) {
      return res.status(404).json({ error: "Source branch not found" });
    }

    if (!targetBranch.head_commit_id || !sourceBranch.head_commit_id) {
      return res.status(400).json({ error: "Both branches must have commits" });
    }

    const mergeCommitId = await withTransaction(async (conn) => {
      const [insertCommit] = await conn.query(
        "INSERT INTO commits (repo_id, branch_id, author_id, message, is_merge) VALUES (?, ?, ?, ?, 1)",
        [targetBranch.repo_id, targetBranch.id, req.user.id, message]
      );

      const newCommitId = insertCommit.insertId;

      await conn.query(
        "INSERT INTO commit_parents (commit_id, parent_commit_id) VALUES (?, ?), (?, ?)",
        [newCommitId, targetBranch.head_commit_id, newCommitId, sourceBranch.head_commit_id]
      );

      await conn.query("UPDATE branches SET head_commit_id = ? WHERE id = ?", [
        newCommitId,
        targetBranch.id
      ]);

      await conn.query(
        "INSERT INTO merges (repo_id, source_branch_id, target_branch_id, merge_commit_id) VALUES (?, ?, ?, ?)",
        [targetBranch.repo_id, sourceBranch.id, targetBranch.id, newCommitId]
      );

      return newCommitId;
    });

    res.status(201).json({ mergeCommitId });
  } catch (error) {
    next(error);
  }
});

router.post("/:branchId/rollback", async (req, res, next) => {
  try {
    const branchId = Number(req.params.branchId);
    const branch = await loadBranch(branchId, req.user.id, { requireOwner: true });
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }

    const targetCommitId = Number(req.body.targetCommitId);
    const reason = (req.body.reason || "").trim() || null;

    if (!targetCommitId) {
      return res.status(400).json({ error: "Target commit is required" });
    }

    const [commitRows] = await pool.query(
      "SELECT c.id FROM commits c JOIN branches b ON b.id = c.branch_id WHERE c.id = ? AND b.repo_id = ?",
      [targetCommitId, branch.repo_id]
    );

    if (commitRows.length === 0) {
      return res.status(404).json({ error: "Commit not found" });
    }

    await withTransaction(async (conn) => {
      await conn.query("UPDATE branches SET head_commit_id = ? WHERE id = ?", [
        targetCommitId,
        branch.id
      ]);

      await conn.query(
        "INSERT INTO rollback_logs (branch_id, from_commit_id, to_commit_id, actor_id, reason) VALUES (?, ?, ?, ?, ?)",
        [branch.id, branch.head_commit_id, targetCommitId, req.user.id, reason]
      );
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
