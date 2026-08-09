import React, { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { COLORS } from "./shared.jsx";
import ChatPanel from "./ChatPanel.jsx";

// A round Intercom-style bubble, always available regardless of which
// dashboard page a client is on — opens the same real support thread shown
// on the Support page (ChatPanel), not a separate/fake widget.
export default function FloatingChatButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            right: 20,
            width: 340,
            maxWidth: "calc(100vw - 32px)",
            zIndex: 400,
          }}
        >
          <ChatPanel />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Chat with support"}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: COLORS.gain,
          color: "#FFFFFF",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 20px rgba(15,157,99,0.35)",
          zIndex: 401,
          cursor: "pointer",
        }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
