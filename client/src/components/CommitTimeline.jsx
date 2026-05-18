export default function CommitTimeline({ commits }) {
  return (
    <div className="space-y-4">
      {commits.map((commit) => (
        <div key={commit.id} className="panel p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-snow">{commit.message}</div>
              <div className="mt-1 text-xs text-mist mono">commit #{commit.id}</div>
            </div>
            <span className="chip">{commit.is_merge ? "merge" : "commit"}</span>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-mist">
            {commit.avatar_url ? (
              <img
                src={commit.avatar_url}
                alt={commit.username}
                className="h-6 w-6 rounded-full border border-ink-700"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-800">
                {commit.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span>{commit.username}</span>
            <span>•</span>
            <span>{new Date(commit.created_at).toLocaleString()}</span>
          </div>
        </div>
      ))}
      {commits.length === 0 && (
        <div className="panel p-5 text-sm text-mist">No commits yet.</div>
      )}
    </div>
  );
}
