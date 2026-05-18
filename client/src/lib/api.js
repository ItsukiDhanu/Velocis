const API_BASE = import.meta.env.VITE_API_BASE || "";

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export async function apiFetch(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (options.body && !headers["Content-Type"] && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...options,
    headers
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const errorMessage = errorPayload.error || "Request failed";
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}
