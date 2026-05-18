import { Link } from "react-router-dom";

export default function RepoCard({ repo }) {
  return (
    <Link to={`/repo/${repo.id}`} className="panel panel-hover group block p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-accent group-hover:underline">
            {repo.name}
          </div>
          {repo.owner_username && (
            <div className="mt-1 text-[11px] text-mist">
              by {repo.is_owner ? "you" : repo.owner_username}
            </div>
          )}
          <p className="mt-2 text-sm text-mist">
            {repo.description || "No description yet."}
          </p>
        </div>
        <span className="chip">{repo.visibility}</span>
      </div>
      <div className="mt-4 flex gap-6 text-xs text-mist">
        <div>
          <div className="text-snow">{repo.branch_count}</div>
          <div>Branches</div>
        </div>
        <div>
          <div className="text-snow">{repo.commit_count}</div>
          <div>Commits</div>
        </div>
      </div>
    </Link>
  );
}
