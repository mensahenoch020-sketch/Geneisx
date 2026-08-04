import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { login, signup, changePassword } from "./api.js";

const COLORS = {
  ink: "#070A08",
  panel: "#0E1510",
  panelBorder: "#1C2A20",
  bone: "#E7EFE9",
  boneDim: "#8CA294",
  gain: "#3FE28E",
  loss: "#e8604c",
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
  background: COLORS.gain,
  color: "#0E1114",
  border: "none",
  borderRadius: 8,
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 600,
  marginTop: 4,
};

const linkButtonStyle = {
  width: "100%",
  background: "transparent",
  border: "none",
  color: COLORS.boneDim,
  fontSize: 12.5,
  marginTop: 14,
  padding: 4,
  textAlign: "center",
};

export default function LoginScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Signup-only fields
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmSignupPassword, setConfirmSignupPassword] = useState("");

  // Once logged in with a temp password, the client is forced through this
  // screen before seeing any account data.
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email.trim(), password);
      if (data.mustChangePassword) {
        setMustChangePassword(true);
      } else {
        onAuthenticated();
      }
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    if (signupPassword.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }
    if (signupPassword !== confirmSignupPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await signup({ name: name.trim(), email: email.trim(), password: signupPassword });
      onAuthenticated();
    } catch (err) {
      setError(err.message || "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 10) {
      setError("New password must be at least 10 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await changePassword(password, newPassword);
      onAuthenticated();
    } catch (err) {
      setError(err.message || "Could not change password");
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
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
        padding: "100px 20px 20px",
      }}
    >
      <style>{`
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div
            style={{
              width: 28,
              height: 28,
              border: `1.5px solid ${COLORS.gain}`,
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.gain,
            }}
          >
            ₿
          </div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>GenesisX</div>
        </div>

        {!mustChangePassword ? (
          mode === "login" ? (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="username"
                />
              </div>
              <div style={{ marginBottom: 8 }}>
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
              {error && (
                <div style={{ color: COLORS.loss, fontSize: 12.5, marginTop: 10 }}>{error}</div>
              )}
              <button style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
                style={linkButtonStyle}
              >
                New here? Create an account →
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Full name</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoComplete="name"
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="username"
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Password</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="At least 10 characters"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={labelStyle}>Confirm password</label>
                <input
                  style={inputStyle}
                  type="password"
                  value={confirmSignupPassword}
                  onChange={(e) => setConfirmSignupPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <div style={{ color: COLORS.loss, fontSize: 12.5, marginTop: 10 }}>{error}</div>
              )}
              <button style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                style={linkButtonStyle}
              >
                ← Already have an account? Sign in
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleChangePassword}>
            <div
              style={{
                display: "flex",
                gap: 8,
                fontSize: 12,
                color: COLORS.boneDim,
                marginBottom: 18,
                lineHeight: 1.5,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${COLORS.panelBorder}`,
                borderRadius: 8,
                padding: 12,
              }}
            >
              <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>You're using a temporary password. Set your own password to continue.</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>New password</label>
              <input
                style={inputStyle}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 10 characters"
                required
                autoComplete="new-password"
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Confirm new password</label>
              <input
                style={inputStyle}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                autoComplete="new-password"
              />
            </div>
            {error && (
              <div style={{ color: COLORS.loss, fontSize: 12.5, marginTop: 10 }}>{error}</div>
            )}
            <button style={{ ...buttonStyle, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? "Saving…" : "Set password & continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
