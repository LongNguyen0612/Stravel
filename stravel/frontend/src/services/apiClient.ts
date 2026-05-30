import type { AdvisorySession, ProposeFirstResponse, SessionListResponse, SessionStatus, TravelerProfile } from "../types/domain";
import type { SessionEventRecord } from "../types/stream";

const BASE_URL = "/api/v1";

function getToken() {
  return localStorage.getItem("token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail?.message || "Request failed");
  }
  return response.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; token_type: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
  },
  sessions: {
    create: () => request<AdvisorySession>("/advisory_sessions", { method: "POST", body: "{}" }),
    get: (id: string) => request<AdvisorySession>(`/advisory_sessions/${id}`),
    list: (limit = 20, offset = 0) =>
      request<SessionListResponse>(`/advisory_sessions?limit=${limit}&offset=${offset}`),
    archive: (id: string) =>
      request<AdvisorySession>(`/advisory_sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" }),
      }),
    updateStatus: (id: string, status: SessionStatus, flag_reason?: string) =>
      request<AdvisorySession>(`/advisory_sessions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(flag_reason ? { flag_reason } : {}) }),
      }),
    run: (id: string) =>
      request<{ status: string }>(`/advisory_sessions/${id}/run`, { method: "POST", body: "{}" }),
    events: (id: string) =>
      request<SessionEventRecord[]>(`/advisory_sessions/${id}/events`),
    proposeFirst: (id: string, message: string) =>
      request<ProposeFirstResponse>(`/advisory_sessions/${id}/propose-first`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
  },
  profile: {
    update: (sessionId: string, data: Partial<TravelerProfile>) =>
      request<TravelerProfile>(`/advisory_sessions/${sessionId}/profile`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },
  userPreferences: {
    // MVP: persists to sessionStorage only — backend endpoint not yet implemented
    saveTripName: (sessionId: string, tripName: string): Promise<void> => {
      if (import.meta.env.DEV) {
        console.warn('[userPreferences] Backend endpoint not yet implemented — storing in sessionStorage');
      }
      try {
        sessionStorage.setItem(`stravel_trip_name_${sessionId}`, tripName);
      } catch (e) {
        console.warn('[userPreferences] sessionStorage unavailable:', e);
      }
      return Promise.resolve();
    },
    getTripName: (sessionId: string): string | null => {
      return sessionStorage.getItem(`stravel_trip_name_${sessionId}`);
    },
  },
};
