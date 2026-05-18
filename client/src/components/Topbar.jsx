import { apiFetch } from "../lib/api";

export default function Topbar({ user, onLogout }) {
  const handleLogout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      onLogout();
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-ink-700 bg-ink-900/95 px-6 py-4">
      <div>
        <div className="text-base font-semibold text-snow">Velocis</div>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="h-9 w-9 rounded-full border border-ink-700"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-800 text-sm">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold text-snow">{user.username}</div>
              <div className="text-xs text-mist">GitHub login</div>
            </div>
          </div>
        )}
        <button className="btn-secondary" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}
