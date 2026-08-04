import React, { useEffect, useState } from "react";
import { Bell, CheckCircle2, XCircle, ArrowDownCircle, Send, KeyRound } from "lucide-react";
import { fetchNotifications, ApiError } from "./api.js";

const COLORS = {
  panel: "#0E1510",
  panelBorder: "#1C2A20",
  bone: "#E7EFE9",
  boneDim: "#8CA294",
  gain: "#3FE28E",
  loss: "#e8604c",
  signal: "#E8B84C",
};

const ICONS = {
  deposit: { Icon: ArrowDownCircle, color: COLORS.gain },
  verification: { Icon: CheckCircle2, color: COLORS.gain },
  withdrawal: { Icon: Send, color: COLORS.signal },
  subscription: { Icon: CheckCircle2, color: COLORS.gain },
  account: { Icon: KeyRound, color: COLORS.boneDim },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Display-only — reads whatever the backend has already logged (deposit
// confirmed, verification reviewed, subscription started, withdrawal
// processed, password changed). No new events are generated here.
export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchNotifications()
      .then((data) => mounted && setNotifications(data.notifications || []))
      .catch((err) => mounted && setError(err instanceof ApiError ? err.message : "Could not load notifications."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 10,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
        <Bell size={16} /> Notifications
      </div>

      {loading && <div style={{ color: COLORS.boneDim, fontSize: 13 }}>Loading…</div>}
      {error && <div style={{ color: COLORS.loss, fontSize: 13 }}>{error}</div>}
      {!loading && !error && notifications.length === 0 && (
        <div style={{ color: COLORS.boneDim, fontSize: 13 }}>Nothing yet — you'll see account activity here.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {notifications.map((n) => {
          const { Icon, color } = ICONS[n.kind] || { Icon: Bell, color: COLORS.boneDim };
          return (
            <div key={n.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Icon size={16} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.bone }}>{n.title}</div>
                <div style={{ fontSize: 12.5, color: COLORS.boneDim, marginTop: 2 }}>{n.body}</div>
              </div>
              <div style={{ fontSize: 11, color: COLORS.boneDim, whiteSpace: "nowrap" }}>{timeAgo(n.createdAt)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
