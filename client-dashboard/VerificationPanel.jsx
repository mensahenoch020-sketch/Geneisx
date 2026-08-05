import React, { useState, useEffect } from "react";
import { ShieldCheck, Upload, Clock, CheckCircle2, XCircle } from "lucide-react";
import { getVerificationStatus, getDocumentTypes, submitVerificationDocument, ApiError } from "./api.js";
import { COLORS } from "./dashboard/shared.jsx";

const inputStyle = {
  width: "100%",
  background: COLORS.ink,
  border: `1px solid ${COLORS.panelBorder}`,
  borderRadius: 8,
  padding: "10px 12px",
  color: COLORS.bone,
  fontSize: 13.5,
  outline: "none",
  marginBottom: 12,
};

const labelStyle = {
  fontSize: 11,
  color: COLORS.boneDim,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 6,
  display: "block",
};

function StatusBadge({ status }) {
  const config = {
    UNVERIFIED: { icon: ShieldCheck, color: COLORS.boneDim, label: "Not verified" },
    PENDING: { icon: Clock, color: COLORS.signal, label: "Pending review" },
    VERIFIED: { icon: CheckCircle2, color: COLORS.gain, label: "Verified" },
    REJECTED: { icon: XCircle, color: COLORS.loss, label: "Resubmission needed" },
  }[status] || { icon: ShieldCheck, color: COLORS.boneDim, label: status };

  const Icon = config.icon;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: config.color,
        background: `${config.color}1a`,
        border: `1px solid ${config.color}4d`,
        borderRadius: 6,
        padding: "4px 10px",
      }}
    >
      <Icon size={13} />
      {config.label}
    </div>
  );
}

export default function VerificationPanel() {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [country, setCountry] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentTypes, setDocumentTypes] = useState([]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function loadStatus() {
    try {
      const data = await getVerificationStatus();
      setStatusData(data);
    } catch (err) {
      if (!(err instanceof ApiError && (err.status === 401 || err.status === 403))) {
        setLoadError(err.message || "Could not load verification status");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!country) {
      setDocumentTypes([]);
      setDocumentType("");
      return;
    }
    let mounted = true;
    getDocumentTypes(country)
      .then((data) => {
        if (!mounted) return;
        setDocumentTypes(data.documentTypes);
        setDocumentType(data.documentTypes[0]?.value || "");
      })
      .catch(() => {
        if (mounted) setDocumentTypes([]);
      });
    return () => {
      mounted = false;
    };
  }, [country]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");
    if (!file) {
      setSubmitError("Choose a file to upload");
      return;
    }
    setSubmitting(true);
    try {
      await submitVerificationDocument({ country, documentType, file });
      setFile(null);
      await loadStatus();
    } catch (err) {
      setSubmitError(err.message || "Could not submit document");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null; // avoid a layout jump for a near-instant status check
  if (loadError) return null; // non-critical section — fail quietly rather than block the whole dashboard

  const status = statusData?.status || "UNVERIFIED";
  const showForm = status === "UNVERIFIED" || status === "REJECTED";

  return (
    <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1px solid ${COLORS.panelBorder}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, color: COLORS.boneDim, textTransform: "uppercase", letterSpacing: 0.6 }}>
          Identity verification
        </div>
        <StatusBadge status={status} />
      </div>

      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 10,
          padding: 18,
        }}
      >
        {status === "VERIFIED" && (
          <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6 }}>
            Your identity has been verified. No further action needed.
          </div>
        )}

        {status === "PENDING" && (
          <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6 }}>
            Your document is submitted and waiting for review. This is a manual check by our
            staff, so it may take a little time — you don't need to do anything else right now.
          </div>
        )}

        {status === "REJECTED" && statusData?.latestSubmission?.reviewNote && (
          <div
            style={{
              fontSize: 12.5,
              color: COLORS.loss,
              lineHeight: 1.6,
              marginBottom: 14,
              background: "rgba(232,96,76,0.08)",
              border: `1px solid rgba(232,96,76,0.25)`,
              borderRadius: 8,
              padding: 12,
            }}
          >
            Your last submission wasn't accepted: {statusData.latestSubmission.reviewNote}. Please try again below.
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit}>
            {status === "UNVERIFIED" && (
              <div style={{ fontSize: 12.5, color: COLORS.boneDim, lineHeight: 1.6, marginBottom: 14 }}>
                Upload a photo of a government-issued ID to verify your account. This is reviewed by our
                staff directly — not shared with any third party.
              </div>
            )}

            <label style={labelStyle}>Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={inputStyle}
              required
            >
              <option value="">Select your country</option>
              {(statusData?.countries || []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>

            {country && (
              <>
                <label style={labelStyle}>Document type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  style={inputStyle}
                  required
                >
                  {documentTypes.map((dt) => (
                    <option key={dt.value} value={dt.value}>
                      {dt.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label style={labelStyle}>Upload photo (JPEG, PNG, or PDF, up to 8MB)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ ...inputStyle, padding: "8px 10px" }}
              required
            />

            {submitError && (
              <div style={{ color: COLORS.loss, fontSize: 12, marginBottom: 10 }}>{submitError}</div>
            )}

            <button
              type="submit"
              disabled={submitting || !country || !documentType || !file}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: COLORS.signal,
                color: COLORS.ink,
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                opacity: submitting || !country || !documentType || !file ? 0.6 : 1,
              }}
            >
              <Upload size={14} /> {submitting ? "Uploading…" : "Submit for review"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
