import { apiUrl } from "../lib/api";

export default function Login() {
  const handleLogin = () => {
    window.location.href = apiUrl("/auth/github");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="panel fade-up w-full max-w-xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-snow md:text-3xl">Velocis</h1>
        <div className="mt-6 flex flex-col items-center gap-4">
          <button className="btn-primary" onClick={handleLogin}>
            Sign in with GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
