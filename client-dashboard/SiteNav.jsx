import React from "react";
import { LogOut } from "lucide-react";

// One shared nav for the whole site — marketing pages and the logged-in
// dashboard both render this, so there's a single consistent header instead
// of two apps with two different top bars. Adapts based on whether a client
// is currently authenticated.
export default function SiteNav({ authed, onNavigate, onLogout }) {
  function go(dest) {
    onNavigate(dest);
  }

  return (
    <nav className="site-nav">
      <button className="brand" onClick={() => go("home")} aria-label="GenesisX home">
        <div className="brand-mark">₿</div>
        GenesisX
      </button>

      <div className="nav-links">
        {!authed ? (
          <>
            <a href="#how" onClick={() => go("home-how")}>How it works</a>
            <a href="#markets" onClick={() => go("home-markets")}>Markets</a>
            <a href="#fees" onClick={() => go("home-fees")}>Fees</a>
            <a href="#risk" onClick={() => go("home-risk")}>Risk</a>
          </>
        ) : (
          <>
            <button onClick={() => go("dashboard")}>Dashboard</button>
            <button onClick={() => go("home-markets")}>Markets</button>
            <button onClick={() => go("home-fees")}>Fees</button>
          </>
        )}
      </div>

      {!authed ? (
        <button className="nav-cta" onClick={() => go("signin")}>
          Sign in
        </button>
      ) : (
        <button
          className="nav-cta"
          onClick={onLogout}
          style={{ background: "transparent", border: "1px solid var(--panel-border)", color: "var(--bone)", display: "flex", alignItems: "center", gap: 6 }}
        >
          <LogOut size={13} /> Log out
        </button>
      )}
    </nav>
  );
}
