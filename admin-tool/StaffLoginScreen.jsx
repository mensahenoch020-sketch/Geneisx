import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { login, ApiError } from "./api.js";

const COLORS = {
  ink: "#0E1114",
  panel: "#161A1F",
  panelBorder: "#262B32",
  bone: "#E8E4DA",
  boneDim: "#9A9689",
  gain: "#3DDC97",
  loss: "#E8604C",
  signal: "#F2B84B",
};

const inputStyle = {
  width: "100%",
  background: COLORS.ink,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 8,
  padding: "11px 12px",
  color: COLORS.bone,
  fontSize: 14,
  outline: "none",
  marginBottom: 14,
};

const labelStyle = {
  fontSize: 11.5,
  color: COLORS.boneDim,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 6,
  display: "block",
};

const buttonStyle = {
  width: "100%",
  background: COLORS.signal,
  color: COLORS.ink,
  border: "none",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 600,
  marginTop: 4,
};

export default function StaffLoginScreen({ onAuthenticated }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password, needsTotp ? totpToken.trim() : undefined);
      onAuthenticated();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && /2FA code required/i.test(err.message)) {
        setNeedsTotp(true);
        setError("");
      } else if (err instanceof ApiError && /TOTP_SETUP_REQUIRED/i.test(err.message)) {
        setError(
          "2FA setup is required for Owner accounts before login. Run the bootstrap-setup flow described in the deployment docs."
        );
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: COLORS.ink,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: COLORS.bone,
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: 20,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: ${COLORS.boneDim}; }
        button { font-family: inherit; cursor: pointer; }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 14,
          padding: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              border: `1.5px solid ${COLORS.signal}`,
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.signal,
            }}
          >
            ₿
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ledger — Staff</div>
        </div>
        <div style={{ fontSize: 12, color: COLORS.boneDim, marginBottom: 22 }}>Client &amp; trade management</div>

        <form onSubmit={handleSubmit}>
          {!needsTotp ? (
            <>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@genesisx.com"
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 12,
                  color: COLORS.boneDim,
                  marginBottom: 16,
                  lineHeight: 1.5,
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${COLORS.panelBorder}`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>Enter the 6-digit code from your authenticator app.</div>
              </div>
              <label style={labelStyle}>2FA code</label>
              <input
                style={{ ...inputStyle, letterSpacing: 4, textAlign: "center", fontSize: 18 }}
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoFocus
                required
              />
            </div>
          )}

          {error && <div style={{ color: COLORS.loss, fontSize: 12.5, marginBottom: 4, lineHeight: 1.5 }}>{error}</div>}

          <button style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? "Signing in…" : needsTotp ? "Verify & sign in" : "Sign in"}
          </button>

          {needsTotp && (
            <button
              type="button"
              onClick={() => {
                setNeedsTotp(false);
                setTotpToken("");
                setError("");
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                color: COLORS.boneDim,
                fontSize: 12.5,
                marginTop: 10,
                padding: 6,
              }}
            >
              ← Back
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
