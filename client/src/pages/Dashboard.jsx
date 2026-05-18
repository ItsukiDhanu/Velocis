import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import RepoCard from "../components/RepoCard.jsx";

export default function Dashboard() {
  const [repositories, setRepositories] = useState([]);
  const [publicRepositories, setPublicRepositories] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const [ownedData, publicData] = await Promise.all([
        apiFetch("/api/repositories"),
        apiFetch("/api/repositories/public")
      ]);
      setRepositories(ownedData.repositories);
      setPublicRepositories(publicData.repositories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepositories();
  }, []);

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await apiFetch("/api/repositories", {
        method: "POST",
        body: JSON.stringify({ name, description, visibility })
      });
      setName("");
      setDescription("");
      setVisibility("public");
      await loadRepositories();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="chip">Repositories</div>
            <h2 className="mt-3 text-xl font-semibold text-snow">Your repositories</h2>
            <p className="mt-2 text-sm text-mist">Create repos and manage them from here.</p>
          </div>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 md:w-[360px]">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Repository name"
              className="input"
            />
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              className="input"
            />
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              className="input"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <button className="btn-primary" type="submit">
              Create repo
            </button>
          </form>
        </div>
        {error && <div className="mt-4 text-sm text-danger">{error}</div>}
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {loading && <div className="panel p-5 text-sm text-mist">Loading repositories...</div>}
        {!loading && repositories.length === 0 && (
          <div className="panel p-5 text-sm text-mist">No repositories yet.</div>
        )}
        {repositories.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-2">
          <div className="chip">Public</div>
          <h3 className="text-lg font-semibold text-snow">Public repos</h3>
          <p className="text-sm text-mist">Repos shared by other people.</p>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading && (
            <div className="panel p-5 text-sm text-mist">Loading public repositories...</div>
          )}
          {!loading && publicRepositories.length === 0 && (
            <div className="panel p-5 text-sm text-mist">No public repositories yet.</div>
          )}
          {publicRepositories.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      </section>
    </div>
  );
}
