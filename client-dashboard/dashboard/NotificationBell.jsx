import React, { useEffect, useRef, useState } from "react";
import { Bell, ArrowDownCircle, CheckCircle2, Send, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchNotifications } from "../api.js";
import { COLORS } from "./shared.jsx";

const ICONS = {
  deposit: { Icon: ArrowDownCircle, color: COLORS.gain },
  verification: { Icon: CheckCircle2, color: COLORS.gain },
  withdrawal: { Icon: Send, color: "#B8790F" },
  subscription: { Icon: CheckCircle2, color: COLORS.gain },
  account: { Icon: KeyRound, color: COLORS.boneDim },
};

const LAST_SEEN_KEY = "genesisx_notifications_last_seen";

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

// The notification data itself already existed (backend derives it from
// AuditLog — deposit confirmed, withdrawal processed, etc.) but was only
// ever visible by scrolling all the way down Settings. This surfaces the
// same real data as a bell in the dashboard header, with an unread count.
// There's no persistent "read" state on the backend, so unread is tracked
// as "created after the last time this bell's dropdown was opened",
// stored in localStorage — a reasonable approximation without needing a
// new backend table just for read receipts.
export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => localStorage.getItem(LAST_SEEN_KEY) || "1970-01-01");
  const containerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    fetchNotifications()
      .then((data) => mounted && setNotifications(data.notifications || []))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => new Date(n.createdAt) > new Date(lastSeen)).length;

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next) {
        const now = new Date().toISOString();
        localStorage.setItem(LAST_SEEN_KEY, now);
        setLastSeen(now);
      }
      return next;
    });
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        style={{
          position: "relative",
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
          borderRadius: 8,
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Bell size={16} color={COLORS.bone} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              background: COLORS.loss,
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 10,
              minWidth: 16,
              height: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 44,
            right: 0,
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(18,24,21,0.12)",
            padding: 12,
            zIndex: 300,
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, padding: "0 4px" }}>Notifications</div>
          {notifications.length === 0 ? (
            <div style={{ fontSize: 12.5, color: COLORS.boneDim, padding: "8px 4px" }}>Nothing yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {notifications.slice(0, 8).map((n) => {
                const { Icon, color } = ICONS[n.kind] || { Icon: Bell, color: COLORS.boneDim };
                return (
                  <div key={n.id} style={{ display: "flex", gap: 10, padding: "8px 4px", borderRadius: 8 }}>
                    <Icon size={15} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{n.title}</div>
                      <div style={{ fontSize: 11.5, color: COLORS.boneDim, marginTop: 1 }}>{n.body}</div>
                    </div>
                    <div style={{ fontSize: 10.5, color: COLORS.boneDim, flexShrink: 0 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 10,
              paddingTop: 10,
              borderTop: `1px solid ${COLORS.panelBorder}`,
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.gain,
            }}
          >
            View all in Settings
          </Link>
        </div>
      )}
    </div>
  );
}
