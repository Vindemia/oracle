const BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const response = await fetchWithAuth(method, path, body);

  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (!refreshed) {
      logout();
      throw new Error('Session expirée');
    }
    const retryResponse = await fetchWithAuth(method, path, body);
    return parseResponse<T>(retryResponse);
  }

  return parseResponse<T>(response);
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

async function fetchWithAuth(method: Method, path: string, body?: unknown): Promise<Response> {
  return fetch(BASE_URL + path, {
    method,
    headers: buildHeaders(),
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    let message = `Erreur ${response.status.toString()}`;
    try {
      const json = JSON.parse(text) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      // réponse non-JSON
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { accessToken: string };
    const token: string = data.accessToken;
    setAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

function logout(): void {
  setAccessToken(null);
  window.location.href = '/login';
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
