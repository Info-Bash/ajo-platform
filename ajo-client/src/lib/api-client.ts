/**
 * Central API client for all REST requests to the NestJS backend.
 * - Reads base URL from NEXT_PUBLIC_API_URL env var
 * - Attaches JWT Bearer token from localStorage on every request
 * - Handles 401s by clearing token and redirecting to /login
 * - Throws typed ApiError on non-2xx responses so TanStack Query
 *   can catch and surface them consistently across the app
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1"

const TOKEN_KEY = "ajo_access_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  // Also write a cookie so Next.js middleware can read it for route protection.
  // Middleware runs on the server and can't access localStorage.
  // Secure + SameSite=Lax — not HttpOnly so JS can clear it on logout.
  const maxAge = 60 * 60 * 24 * 7 // 7 days, matches JWT expiry
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${maxAge}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  // Clear the cookie too
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  /** Skip auth header (e.g. for login/register endpoints) */
  skipAuth?: boolean
}

async function request<T>(
  path: string,
  { body, skipAuth = false, ...init }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  }

  if (!skipAuth) {
    const token = getToken()
    if (token) headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Token expired or invalid — clear and redirect to login.
  // Skip the redirect for auth endpoints (login/register/etc.) — a 401 there
  // is just "wrong credentials" and should surface as a normal form error.
  if (response.status === 401) {
    if (!skipAuth) {
      clearToken()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
      throw new ApiError(401, "Session expired. Please log in again.")
    }
    // fall through so the body is parsed and the real server message is thrown
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const err = await response.json()
      message = err?.message ?? message
    } catch {
      // response body isn't JSON — use default message
    }
    throw new ApiError(response.status, message)
  }

  // 204 No Content — nothing to parse
  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
}