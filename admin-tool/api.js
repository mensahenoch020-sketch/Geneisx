// Thin API client for the staff-facing admin tool.
// Token kept in sessionStorage (clears on tab close) rather than localStorage —
// this tool can process withdrawals, so a stale logged-in session on a shared
// or public machine is a real risk worth minimizing.

const TOKEN_KEY = "genesisx_staff_token";

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
    // sessionStorage unavailable — session just won't persist across reloads
  }
}

export function clearToken() {
  setToken(null);
}

export class ApiError extends Error {
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
    // no JSON body
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

// ---------- Auth ----------
export async function login(email, password, totpToken) {
  const data = await request("/auth/staff/login", {
    method: "POST",
    body: { email, password, ...(totpToken ? { totpToken } : {}) },
  });
  setToken(data.token);
  return data;
}

// ---------- Clients ----------
export async function listClients() {
  return request("/api/clients");
}

export async function getClient(id) {
  return request(`/api/clients/${encodeURIComponent(id)}`);
}

export async function getRevenue() {
  return request("/api/clients/revenue/summary");
}

export async function createClient({ name, email, contact, walletRef }) {
  return request("/api/clients", { method: "POST", body: { name, email, contact, walletRef } });
}

// ---------- Deposits ----------
export async function createDeposit({ clientId, amountUsd, txHash }) {
  return request("/api/deposits", { method: "POST", body: { clientId, amountUsd, txHash } });
}

// ---------- Withdrawals ----------
export async function createWithdrawal({ clientId, amountUsd, destination }) {
  return request("/api/withdrawals", { method: "POST", body: { clientId, amountUsd, destination } });
}

export async function processWithdrawal(id, txHash) {
  return request(`/api/withdrawals/${encodeURIComponent(id)}/process`, {
    method: "POST",
    body: { txHash },
  });
}

export async function cancelWithdrawal(id) {
  return request(`/api/withdrawals/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

// ---------- Trades ----------
export async function createTrade({ clientId, asset, side, size, entry, exit }) {
  return request("/api/trades", {
    method: "POST",
    body: {
      clientId,
      asset,
      side: side.toUpperCase(),
      size,
      entry,
      ...(exit ? { exit } : {}),
    },
  });
}

export async function closeTrade(id, exit) {
  return request(`/api/trades/${encodeURIComponent(id)}/close`, { method: "POST", body: { exit } });
}

// ---------- Reconciliation ----------
export async function getExpectedHoldings() {
  return request("/api/reconciliation/expected");
}

export async function runReconciliationCheck(actualUsd, note) {
  return request("/api/reconciliation/check", { method: "POST", body: { actualUsd, note } });
}

export async function getReconciliationHistory() {
  return request("/api/reconciliation/history");
}

// ---------- Statements ----------
// Fetched with the Authorization header and saved via Blob, so auth stays
// header-only everywhere — no token ever travels in a URL/query string.
export async function downloadClientStatement(clientId, format) {
  const token = getToken();
  const res = await fetch(`/api/statements/${encodeURIComponent(clientId)}?format=${encodeURIComponent(format)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 || res.status === 403) clearToken();
  if (!res.ok) {
    let message = `Could not generate statement (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // response wasn't JSON
    }
    throw new ApiError(message, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `statement-${clientId}.${format === "csv" ? "csv" : "pdf"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Verification ----------
export async function getVerificationQueue() {
  return request("/api/verification/queue");
}

export async function reviewVerification(documentId, approve, note) {
  return request(`/api/verification/${encodeURIComponent(documentId)}/review`, {
    method: "POST",
    body: { approve, ...(note ? { note } : {}) },
  });
}

// Returns a viewable URL for the document file. Auth still required — the
// browser sends the request with cookies/session in most flows, but this app
// uses bearer tokens, so this is meant to be used with an <img>/<iframe> whose
// src includes the token isn't possible without a query param. Since staff
// review is a low-frequency, staff-only action, we open it via a fetch+blob
// helper instead, matching the pattern used for statement downloads.
export async function viewVerificationDocument(documentId) {
  const token = getToken();
  const res = await fetch(`/api/verification/${encodeURIComponent(documentId)}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 || res.status === 403) clearToken();
  if (!res.ok) throw new ApiError(`Could not load document (${res.status})`, res.status);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
