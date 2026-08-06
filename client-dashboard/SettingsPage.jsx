import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ShieldOff } from "lucide-react";
import { fetchMe, updateProfile, changePassword, totpSetup, totpVerify, totpDisable, ApiError } from "./api.js";
import NotificationsPanel from "./NotificationsPanel.jsx";
import VerificationPanel from "./VerificationPanel.jsx";
import { COLORS } from "./dashboard/shared.jsx";

const inputStyle = {
  width: "100%",
  background: COLORS.page,
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
  background: COLORS.gain,
  color: "#0E1114",
  border: "none",
  borderRadius: 8,
  padding: "11px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const cardStyle = {
  background: COLORS.panel,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 10,
  padding: 20,
  marginBottom: 24,
};

function ProfileSection() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((data) => {
        if (!mounted) return;
        setName(data.name || "");
        setContact(data.contact || "");
        setEmail(data.email || "");
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await updateProfile({ name, contact });
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={cardStyle}>Loading…</div>;

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Profile</div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email</label>
          <input style={{ ...inputStyle, opacity: 0.6 }} value={email} disabled />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Contact info</label>
          <input
            style={inputStyle}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Phone or alternate contact"
            maxLength={200}
          />
        </div>
        {error && <div style={{ color: COLORS.loss, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: COLORS.gain, fontSize: 13, marginBottom: 12 }}>{success}</div>}
        <button style={buttonStyle} type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 10) {
      setError("New password must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Change password</div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Current password</label>
          <input
            style={inputStyle}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>New password</label>
          <input style={inputStyle} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Confirm new password</label>
          <input
            style={inputStyle}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error && <div style={{ color: COLORS.loss, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: COLORS.gain, fontSize: 13, marginBottom: 12 }}>{success}</div>}
        <button style={buttonStyle} type="submit" disabled={saving}>
          {saving ? "Changing…" : "Change password"}
        </button>
      </form>
    </div>
  );
}

function TwoFactorSection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((data) => mounted && setEnabled(!!data.totpEnabled))
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  async function startEnroll() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const data = await totpSetup();
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setEnrolling(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start 2FA setup.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmEnroll(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await totpVerify(verifyToken.trim());
      setEnabled(true);
      setEnrolling(false);
      setVerifyToken("");
      setSuccess("2FA is now enabled on your account.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDisable(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await totpDisable(disablePassword);
      setEnabled(false);
      setShowDisableForm(false);
      setDisablePassword("");
      setSuccess("2FA has been turned off.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not disable 2FA.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={cardStyle}>Loading…</div>;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {enabled ? <ShieldCheck size={17} color={COLORS.gain} /> : <ShieldOff size={17} color={COLORS.boneDim} />}
        <div style={{ fontSize: 16, fontWeight: 700 }}>Two-factor authentication</div>
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6, marginBottom: 16 }}>
        {enabled
          ? "2FA is on — you'll need a code from your authenticator app every time you sign in."
          : "Add an extra step at login using an authenticator app (Google Authenticator, Authy, 1Password, etc.)."}
      </div>

      {!enabled && !enrolling && (
        <button style={buttonStyle} onClick={startEnroll} disabled={saving}>
          {saving ? "Starting…" : "Enable 2FA"}
        </button>
      )}

      {enrolling && (
        <form onSubmit={confirmEnroll}>
          <div style={{ fontSize: 13, marginBottom: 12 }}>Scan this with your authenticator app:</div>
          {qrCodeDataUrl && (
            <div style={{ background: "#FFFFFF", borderRadius: 10, padding: 16, display: "inline-block", marginBottom: 12 }}>
              <img src={qrCodeDataUrl} alt="2FA QR code" width={160} height={160} />
            </div>
          )}
          <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginBottom: 14 }}>
            Can't scan? Enter this key manually: <span className="mono">{secret}</span>
          </div>
          <label style={labelStyle}>Enter the 6-digit code to confirm</label>
          <input
            style={{ ...inputStyle, letterSpacing: 4, textAlign: "center", marginBottom: 14 }}
            inputMode="numeric"
            maxLength={6}
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            required
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button style={buttonStyle} type="submit" disabled={saving}>
              {saving ? "Verifying…" : "Confirm & enable"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEnrolling(false);
                setVerifyToken("");
              }}
              style={{ ...buttonStyle, background: "transparent", border: `1px solid ${COLORS.panelBorder}`, color: COLORS.bone }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {enabled && !showDisableForm && (
        <button
          onClick={() => setShowDisableForm(true)}
          style={{ ...buttonStyle, background: "transparent", border: `1px solid ${COLORS.loss}`, color: COLORS.loss }}
        >
          Disable 2FA
        </button>
      )}

      {enabled && showDisableForm && (
        <form onSubmit={confirmDisable}>
          <label style={labelStyle}>Confirm your password to disable 2FA</label>
          <input
            style={{ ...inputStyle, marginBottom: 14 }}
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            required
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...buttonStyle, background: COLORS.loss }}
              type="submit"
              disabled={saving}
            >
              {saving ? "Disabling…" : "Confirm disable"}
            </button>
            <button
              type="button"
              onClick={() => setShowDisableForm(false)}
              style={{ ...buttonStyle, background: "transparent", border: `1px solid ${COLORS.panelBorder}`, color: COLORS.bone }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <div style={{ color: COLORS.loss, fontSize: 13, marginTop: 12 }}>{error}</div>}
      {success && <div style={{ color: COLORS.gain, fontSize: 13, marginTop: 12 }}>{success}</div>}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 640 }}>
      <Link
        to="/dashboard"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.boneDim, fontSize: 13, marginBottom: 24, textDecoration: "none" }}
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Settings</div>
      <ProfileSection />
      <PasswordSection />
      <TwoFactorSection />
      <VerificationPanel />
      <NotificationsPanel />
    </div>
  );
}
