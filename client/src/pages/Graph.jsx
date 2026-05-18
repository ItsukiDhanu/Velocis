import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import CommitGraph from "../components/CommitGraph.jsx";

export default function Graph() {
  const { repoId } = useParams();
  const [graph, setGraph] = useState({ commits: [], parents: [], branches: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    apiFetch(`/api/repositories/${repoId}/graph`)
      .then((data) => {
        if (active) {
          setGraph(data);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [repoId]);

  if (loading) {
    return <div className="panel p-5 text-sm text-mist">Loading commit graph...</div>;
  }

  if (error) {
    return <div className="panel p-5 text-sm text-danger">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="chip">Graph</div>
            <h2 className="mt-3 text-xl font-semibold text-snow">Branch map</h2>
            <p className="mt-2 text-sm text-mist">
              See links, merges, and current head pointers.
            </p>
          </div>
          <Link className="btn-secondary" to={`/repo/${repoId}`}>
            Back to repository
          </Link>
        </div>
      </section>
      <CommitGraph
        commits={graph.commits}
        parents={graph.parents}
        branches={graph.branches}
      />
    </div>
  );
}
