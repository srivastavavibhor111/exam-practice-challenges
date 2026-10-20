/**
 * api.js — UPDATED FOR M18
 * ─────────────────────────────────────────────────────────────────────────────
 * CRITICAL FIX: the base URL is now configurable via VITE_API_URL, an
 * environment variable Vite bakes in at BUILD time (not runtime — this is
 * a static site once built, there's no server to read env vars from later).
 *
 * WHY THIS WAS BROKEN BEFORE: `/api` as a relative path only ever worked
 * because Vite's DEV server proxies it to localhost:5000 (vite.config.js,
 * M1). That proxy does not exist in a production build — there's no Vite
 * dev server running at all, just static files served by Vercel. A
 * deployed frontend calling a relative `/api/...` path would be calling
 * ITSELF (Vercel's own domain), which has no API to respond — every
 * single request would 404.
 *
 * Local development is UNCHANGED: if VITE_API_URL isn't set, this falls
 * back to '/api', which still works via the dev proxy exactly as before.
 * In production, set VITE_API_URL to your real deployed backend's URL
 * (e.g. https://your-backend.onrender.com/api) as a Vercel environment
 * variable — see DEPLOYMENT.md.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiRequest(path, { method = 'GET', body, params } = {}) {
  let url = `${BASE}${path}`;

  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (query) url += `?${query}`;
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // No JSON body (e.g. a 204 No Content) — leave data as null.
  }

  if (!response.ok) {
    if (data?.error?.message) {
      throw new ApiError(data.error.message, response.status);
    }
    return data;
  }

  return data;
}

export { apiRequest, ApiError };
