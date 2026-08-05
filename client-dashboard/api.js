// Thin API client for the client-facing dashboard.
// Token is kept in memory + sessionStorage (not localStorage) so it clears when
// the browser tab closes, reducing the window a stolen device stays logged in.
// This is a client-facing app for real account balances — treat the session
// token with the same care as a banking app would.

const TOKEN_KEY = "genesisx_client_token";

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // sessionStorage unavailable (e.g. privacy mode) — session just won't persist across reloads.
  }
}

export function clearToken() {
  setToken(null);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    clearToken();
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body (e.g. empty response)
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

export async function login(email, password) {
  const data = await request("/auth/client/login", { method: "POST", body: { email, password } });
  setToken(data.token);
  return data;
}

export async function signup({ name, email, password, contact }) {
  const data = await request("/auth/client/signup", {
    method: "POST",
    body: { name, email, password, ...(contact ? { contact } : {}) },
  });
  setToken(data.token);
  return data;
}

export async function subscribe(tierKey, amountUsd) {
  return request("/api/me/subscribe", { method: "POST", body: { tierKey, amountUsd } });
}

export async function changePassword(currentPassword, newPassword) {
  return request("/auth/client/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

export async function fetchMe() {
  return request("/api/me");
}

export async function updateProfile({ name, contact }) {
  return request("/api/me/profile", { method: "PATCH", body: { name, contact } });
}

export async function fetchNotifications() {
  return request("/api/notifications");
}

export async function fetchPerformance(range) {
  return request(`/api/me/performance?range=${encodeURIComponent(range)}`);
}

// Downloads the statement as a file. Fetched with the Authorization header
// (never a token in the URL/query string) and saved via a Blob, so the auth
// model stays header-only everywhere in this app — no special-cased routes.
export async function downloadStatement(format) {
  const token = getToken();
  const res = await fetch(`/api/me/statement?format=${encodeURIComponent(format)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 || res.status === 403) clearToken();
  if (!res.ok) {
    let message = `Could not generate statement (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // response wasn't JSON (likely the file itself failed before headers) — keep default message
    }
    throw new ApiError(message, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `genesisx-statement.${format === "csv" ? "csv" : "pdf"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function getVerificationStatus() {
  return request("/api/me/verification");
}

export async function getDocumentTypes(country) {
  return request(`/api/me/verification/document-types?country=${encodeURIComponent(country)}`);
}

// Multipart upload — bypasses the shared JSON request() helper since this
// sends FormData, not a JSON body, but still attaches the auth header and
// applies the same auth-error handling as everything else.
export async function submitVerificationDocument({ country, documentType, file }) {
  const token = getToken();
  const formData = new FormData();
  formData.append("country", country);
  formData.append("documentType", documentType);
  formData.append("document", file);

  const res = await fetch("/api/me/verification", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401 || res.status === 403) clearToken();

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }
  if (!res.ok) {
    throw new ApiError(data?.error || `Upload failed (${res.status})`, res.status);
  }
  return data;
}

export { ApiError };
