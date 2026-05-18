import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import BranchSelector from "../components/BranchSelector.jsx";
import CommitTimeline from "../components/CommitTimeline.jsx";
import Modal from "../components/Modal.jsx";

export default function Repository() {
  const { repoId } = useParams();
  const [repo, setRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [currentBranchId, setCurrentBranchId] = useState(null);
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [branchName, setBranchName] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [stagedFiles, setStagedFiles] = useState([]);
  const [repoFiles, setRepoFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState(null);
  const [mergeMessage, setMergeMessage] = useState("");

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackCommitId, setRollbackCommitId] = useState(null);
  const [rollbackReason, setRollbackReason] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);

  const navigate = useNavigate();

  const isOwner = repo && Number(repo.is_owner) === 1;
  const currentBranch = branches.find((branch) => branch.id === currentBranchId);
  const commitCardErrorMessages = new Set([
    "No staged files to commit",
    "Commit message is required"
  ]);
  const commitCardError = commitCardErrorMessages.has(error) ? error : "";

  const branchOptions = useMemo(
    () => branches.filter((branch) => branch.id !== currentBranchId),
    [branches, currentBranchId]
  );

  const loadRepository = async () => {
    try {
      setLoading(true);
      const repoData = await apiFetch(`/api/repositories/${repoId}`);
      const branchData = await apiFetch(`/api/repositories/${repoId}/branches`);
      setRepo(repoData.repository);
      setBranches(branchData.branches);

      const defaultBranch =
        branchData.branches.find((branch) => branch.is_default === 1) ||
        branchData.branches[0];

      if (!currentBranchId || !branchData.branches.find((b) => b.id === currentBranchId)) {
        setCurrentBranchId(defaultBranch ? defaultBranch.id : null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCommits = async (branchId) => {
    if (!branchId) {
      setCommits([]);
      return;
    }
    try {
      const data = await apiFetch(`/api/branches/${branchId}/commits`);
      setCommits(data.commits);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadStaging = async (branchId) => {
    if (!branchId || !isOwner) {
      setStagedFiles([]);
      return;
    }

    try {
      const data = await apiFetch(
        `/api/repositories/${repoId}/staging?branchId=${branchId}`
      );
      setStagedFiles(data.files);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadFiles = async (branchId) => {
    if (!branchId) {
      setRepoFiles([]);
      return;
    }

    try {
      const data = await apiFetch(`/api/repositories/${repoId}/files?branchId=${branchId}`);
      setRepoFiles(data.files);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadRepository();
  }, [repoId]);

  useEffect(() => {
    loadCommits(currentBranchId);
  }, [currentBranchId]);

  useEffect(() => {
    loadFiles(currentBranchId);
  }, [currentBranchId]);

  useEffect(() => {
    loadStaging(currentBranchId);
  }, [currentBranchId, isOwner]);

  useEffect(() => {
    setSelectedFiles([]);
    setFileInputKey((prev) => prev + 1);
  }, [currentBranchId]);

  useEffect(() => {
    if (branchOptions.length > 0) {
      setMergeSourceId(branchOptions[0].id);
    }
  }, [branchOptions]);

  useEffect(() => {
    if (commits.length > 0) {
      setRollbackCommitId(commits[0].id);
    }
  }, [commits]);

  const handleCreateBranch = async (event) => {
    event.preventDefault();
    setError("");

    if (!isOwner) {
      return;
    }

    try {
      await apiFetch(`/api/repositories/${repoId}/branches`, {
        method: "POST",
        body: JSON.stringify({ name: branchName, fromBranchId: currentBranchId })
      });
      setBranchName("");
      await loadRepository();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateCommit = async (event) => {
    event.preventDefault();
    setError("");

    if (!isOwner) {
      return;
    }

    if (!commitMessage.trim()) {
      setError("Commit message is required");
      return;
    }

    if (stagedFiles.length === 0) {
      setError("No staged files to commit");
      return;
    }

    try {
      await apiFetch(`/api/repositories/${repoId}/commit`, {
        method: "POST",
        body: JSON.stringify({ branchId: currentBranchId, message: commitMessage })
      });
      setCommitMessage("");
      await loadRepository();
      await loadCommits(currentBranchId);
      await loadStaging(currentBranchId);
      await loadFiles(currentBranchId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMerge = async () => {
    setError("");
    if (!isOwner) {
      return;
    }
    try {
      await apiFetch(`/api/branches/${currentBranchId}/merge`, {
        method: "POST",
        body: JSON.stringify({ sourceBranchId: mergeSourceId, message: mergeMessage })
      });
      setMergeOpen(false);
      setMergeMessage("");
      await loadRepository();
      await loadCommits(currentBranchId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRollback = async () => {
    setError("");
    if (!isOwner) {
      return;
    }
    try {
      await apiFetch(`/api/branches/${currentBranchId}/rollback`, {
        method: "POST",
        body: JSON.stringify({ targetCommitId: rollbackCommitId, reason: rollbackReason })
      });
      setRollbackOpen(false);
      setRollbackReason("");
      await loadRepository();
      await loadCommits(currentBranchId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRepository = async () => {
    setError("");
    if (!isOwner) {
      return;
    }

    try {
      await apiFetch(`/api/repositories/${repoId}`, { method: "DELETE" });
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteOpen(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined) {
      return "n/a";
    }
    if (bytes === 0) {
      return "0 B";
    }
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    const value = bytes / 1024 ** index;
    const precision = value >= 10 || index === 0 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[index]}`;
  };

  const formatTimestamp = (value) => {
    if (!value) {
      return "n/a";
    }
    return new Date(value).toLocaleString();
  };

  const handleFileSelection = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
    setFileInputKey((prev) => prev + 1);
  };

  const handleUploadFiles = async (event) => {
    event.preventDefault();
    setError("");

    if (!isOwner) {
      return;
    }

    if (!currentBranchId) {
      setError("Select a branch before staging files");
      return;
    }

    if (selectedFiles.length === 0) {
      setError("Select files to upload");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("branchId", currentBranchId);
      selectedFiles.forEach((file) => formData.append("files", file));

      await apiFetch(`/api/repositories/${repoId}/staging`, {
        method: "POST",
        body: formData
      });

      setSelectedFiles([]);
      setFileInputKey((prev) => prev + 1);
      await loadStaging(currentBranchId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnstage = async (stagingId) => {
    setError("");
    if (!isOwner) {
      return;
    }

    try {
      await apiFetch(`/api/repositories/${repoId}/staging/${stagingId}`, {
        method: "DELETE"
      });
      await loadStaging(currentBranchId);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="panel p-5 text-sm text-mist">Loading repository...</div>;
  }

  if (!repo) {
    return <div className="panel p-5 text-sm text-mist">Repository not found.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="chip">Repository</div>
            <h2 className="mt-3 text-xl font-semibold text-snow">{repo.name}</h2>
            <p className="mt-2 text-sm text-mist">
              {repo.description || "No description provided."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-secondary" to={`/repo/${repo.id}/graph`}>
              View graph
            </Link>
            <button
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setMergeOpen(true)}
              disabled={!isOwner || branchOptions.length === 0}
            >
              Merge
            </button>
            <button
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setRollbackOpen(true)}
              disabled={!isOwner || commits.length === 0}
            >
              Rollback
            </button>
            {isOwner && (
              <button className="btn-danger" onClick={() => setDeleteOpen(true)}>
                Delete repo
              </button>
            )}
          </div>
        </div>
        {error && !commitCardErrorMessages.has(error) && (
          <div className="mt-4 text-sm text-danger">{error}</div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <div className="panel p-5">
            <BranchSelector
              branches={branches}
              value={currentBranchId}
              onChange={setCurrentBranchId}
            />
            {!isOwner && (
              <div className="mt-4 text-xs text-mist">
                Read-only view. Branch actions are locked.
              </div>
            )}
            {currentBranch && (
              <div className="mt-4 text-xs text-mist">
                HEAD: {currentBranch.head_message || "No commits"}
              </div>
            )}
          </div>

          <div className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="chip">Staging</div>
                <h3 className="mt-2 text-sm font-semibold text-snow">Stage files</h3>
                <p className="mt-1 text-xs text-mist">
                  Pick files to stage before you commit (max 10 MB each).
                </p>
              </div>
              <div className="text-xs text-mist">{stagedFiles.length} staged</div>
            </div>

            {!isOwner ? (
              <div className="mt-4 text-xs text-mist">
                Only owners can stage files.
              </div>
            ) : (
              <>
                <form className="mt-4 space-y-3" onSubmit={handleUploadFiles}>
                  <input
                    key={fileInputKey}
                    type="file"
                    multiple
                    onChange={handleFileSelection}
                    className="input disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!currentBranchId}
                  />
                  {selectedFiles.length > 0 && (
                    <div className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3 text-xs text-mist">
                      <div className="text-xs font-semibold text-snow">Selected files</div>
                      <div className="mt-2 space-y-1">
                        {selectedFiles.map((file) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="mono text-snow">{file.name}</span>
                            <span>{formatBytes(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                      type="submit"
                      disabled={!currentBranchId || selectedFiles.length === 0}
                    >
                      Stage files
                    </button>
                    <button
                      className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      onClick={handleClearSelection}
                      disabled={selectedFiles.length === 0}
                    >
                      Clear
                    </button>
                  </div>
                </form>

                <div className="mt-4 space-y-3">
                  {stagedFiles.length === 0 ? (
                    <div className="text-sm text-mist">Nothing staged yet.</div>
                  ) : (
                    stagedFiles.map((file) => {
                      const actionLabel = (file.action || "update").toUpperCase();
                      return (
                        <div
                          key={file.id}
                          className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold text-snow mono">
                                {file.file_path}
                              </div>
                              <div className="mt-1 text-xs text-mist">
                                {actionLabel} • {formatBytes(file.size_bytes)} •{" "}
                                {formatTimestamp(file.created_at)}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className="chip">{actionLabel}</span>
                              <button
                                className="btn-secondary text-xs"
                                type="button"
                                onClick={() => handleUnstage(file.id)}
                              >
                                Unstage
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          <form className="panel space-y-4 p-5" onSubmit={handleCreateCommit}>
            <div className="text-sm font-semibold text-snow">New commit</div>
            <input
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder="Commit message"
              className="input disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isOwner}
            />
            {commitCardError && (
              <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {commitCardError}
              </div>
            )}
            <div className="text-xs text-mist">
              Staged files: <span className="text-snow">{stagedFiles.length}</span>
            </div>
            <button
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!isOwner}
            >
              Commit to {currentBranch ? currentBranch.name : "branch"}
            </button>
          </form>

          <form className="panel space-y-4 p-5" onSubmit={handleCreateBranch}>
            <div className="text-sm font-semibold text-snow">New branch</div>
            <input
              value={branchName}
              onChange={(event) => setBranchName(event.target.value)}
              placeholder="Branch name"
              className="input disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isOwner}
            />
            <button
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!isOwner}
            >
              Create branch from {currentBranch ? currentBranch.name : "branch"}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="chip">Files</div>
                <h3 className="mt-2 text-lg font-semibold text-snow">Files</h3>
                <p className="mt-1 text-xs text-mist">
                  Latest files for {currentBranch ? currentBranch.name : "branch"}.
                </p>
              </div>
              <div className="text-xs text-mist">{repoFiles.length} files</div>
            </div>

            <div className="mt-4 space-y-3">
              {repoFiles.length === 0 ? (
                <div className="text-sm text-mist">No files committed yet.</div>
              ) : (
                repoFiles.map((file) => {
                  const actionLabel = (file.action || "update").toUpperCase();
                  return (
                    <div
                      key={file.file_id}
                      className="rounded-lg border border-ink-700/60 bg-ink-900/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-snow mono">
                            {file.file_path}
                          </div>
                          <div className="mt-1 text-xs text-mist">
                            {actionLabel} • {formatBytes(file.size_bytes)}
                          </div>
                        </div>
                        <span className="chip">{actionLabel}</span>
                      </div>
                      <div className="mt-2 text-xs text-mist">
                        <span>
                          {file.commit_message
                            ? `"${file.commit_message}"`
                            : "Latest commit"}
                        </span>
                        {file.author_username && (
                          <span> by {file.author_username}</span>
                        )}
                        <span> • {formatTimestamp(file.commit_created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="chip">Timeline</div>
                <h3 className="mt-2 text-lg font-semibold text-snow">History</h3>
              </div>
            </div>
            <CommitTimeline commits={commits} />
          </div>
        </div>
      </section>

      <Modal
        open={mergeOpen}
        title="Merge branches"
        onClose={() => setMergeOpen(false)}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setMergeOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleMerge}>
              Merge
            </button>
          </>
        }
      >
        <div>
          Select the branch to merge into <span className="text-snow">{currentBranch?.name}</span>.
        </div>
        <select
          value={mergeSourceId || ""}
          onChange={(event) => setMergeSourceId(Number(event.target.value))}
          className="input"
        >
          {branchOptions.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <input
          value={mergeMessage}
          onChange={(event) => setMergeMessage(event.target.value)}
          placeholder="Merge commit message"
          className="input"
        />
      </Modal>

      <Modal
        open={rollbackOpen}
        title="Rollback"
        onClose={() => setRollbackOpen(false)}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setRollbackOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleRollback}>
              Rollback
            </button>
          </>
        }
      >
        <div>Select a commit to move head to.</div>
        <select
          value={rollbackCommitId || ""}
          onChange={(event) => setRollbackCommitId(Number(event.target.value))}
          className="input"
        >
          {commits.map((commit) => (
            <option key={commit.id} value={commit.id}>
              {commit.message}
            </option>
          ))}
        </select>
        <input
          value={rollbackReason}
          onChange={(event) => setRollbackReason(event.target.value)}
          placeholder="Reason (optional)"
          className="input"
        />
      </Modal>

      <Modal
        open={deleteOpen}
        title="Delete repo"
        onClose={() => setDeleteOpen(false)}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </button>
            <button className="btn-danger" onClick={handleDeleteRepository}>
              Delete permanently
            </button>
          </>
        }
      >
        <div>
          This will permanently delete the repo, branches, commits, and logs.
        </div>
      </Modal>
    </div>
  );
}
