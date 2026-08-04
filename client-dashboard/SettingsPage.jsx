import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { fetchMe, updateProfile, changePassword, ApiError } from "./api.js";
import NotificationsPanel from "./NotificationsPanel.jsx";

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

export default function SettingsPage() {
  return (
    <div className="wrap" style={{ padding: "36px 20px 80px", maxWidth: 640 }}>
      <Link
        to="/dashboard"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.boneDim, fontSize: 13, marginBottom: 24, textDecoration: "none" }}
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Settings</div>
      <ProfileSection />
      <PasswordSection />
      <NotificationsPanel />
    </div>
  );
}
