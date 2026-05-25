const BASE_URL = "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.message || "Request failed");
  }
  return response.json();
}

export const api = {
  sessions: {
    create: () => request<unknown>("/advisory_sessions", { method: "POST", body: "{}" }),
    get: (id: string) => request<unknown>(`/advisory_sessions/${id}`),
    list: (limit = 20, offset = 0) => request<unknown>(`/advisory_sessions?limit=${limit}&offset=${offset}`),
    update: (id: string, status: string) =>
      request<unknown>(`/advisory_sessions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  },
};
