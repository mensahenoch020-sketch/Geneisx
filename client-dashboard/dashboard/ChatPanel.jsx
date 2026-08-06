import React, { useEffect, useRef, useState } from "react";
import { Send, MessageCircle } from "lucide-react";
import { fetchMessages, sendMessage as sendMessageApi } from "../api.js";
import { COLORS, Card } from "./shared.jsx";

const POLL_MS = 8000;

function timeLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// A real chat thread with staff — not a third-party widget. Polls every 8s
// for new messages rather than a websocket, since that works on any host
// without extra real-time infrastructure. Staff reply from the admin tool's
// inbox (see admin-tool/dashboard.jsx "Messages" section).
export default function ChatPanel() {
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const isFirstLoad = useRef(true);

  async function load() {
    try {
      const data = await fetchMessages();
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.message || "Could not load messages");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages && isFirstLoad.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      isFirstLoad.current = false;
    }
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError("");
    try {
      await sendMessageApi(body);
      setDraft("");
      await load();
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Could not send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 18px", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
        <MessageCircle size={16} color={COLORS.gain} />
        <div style={{ fontSize: 15, fontWeight: 700 }}>Chat with support</div>
      </div>

      <div style={{ height: 320, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages === null ? (
          <div style={{ fontSize: 12.5, color: COLORS.boneDim }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 12.5, color: COLORS.boneDim, textAlign: "center", marginTop: 40 }}>
            No messages yet — send one below and we'll reply here.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderType === "CLIENT";
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "78%",
                    background: mine ? COLORS.gain : COLORS.page,
                    color: mine ? "#FFFFFF" : COLORS.bone,
                    borderRadius: mine ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    padding: "9px 13px",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                  <div
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      opacity: 0.7,
                      textAlign: mine ? "right" : "left",
                    }}
                  >
                    {timeLabel(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${COLORS.panelBorder}` }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          maxLength={4000}
          style={{
            flex: 1,
            background: COLORS.page,
            border: `1px solid ${COLORS.panelBorder}`,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13.5,
            color: COLORS.bone,
          }}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          style={{
            background: COLORS.gain,
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            width: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: sending || !draft.trim() ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </form>
      {error && <div style={{ color: COLORS.loss, fontSize: 12, padding: "0 16px 12px" }}>{error}</div>}
    </Card>
  );
}
