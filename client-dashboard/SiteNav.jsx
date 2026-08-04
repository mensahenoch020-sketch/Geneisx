import React from "react";
import { Link } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";

// One shared nav for the whole site — marketing pages and the logged-in
// dashboard both render this, so there's a single consistent header instead
// of two apps with two different top bars. Adapts based on whether a client
// is currently authenticated. Uses real <Link> routes now instead of a
// custom onNavigate view-switcher, so every nav item is a real URL.
export default function SiteNav({ authed, onNavigate, onLogout }) {
  return (
    <nav className="site-nav">
      <Link className="brand" to="/" aria-label="GenesisX home">
        <div className="brand-mark">₿</div>
        GenesisX
      </Link>

      <div className="nav-links">
        {!authed ? (
          <>
            <a href="#how" onClick={() => onNavigate("home-how")}>How it works</a>
            <a href="#markets" onClick={() => onNavigate("home-markets")}>Markets</a>
            <a href="#fees" onClick={() => onNavigate("home-fees")}>Fees</a>
            <a href="#risk" onClick={() => onNavigate("home-risk")}>Risk</a>
          </>
        ) : (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <a href="#markets" onClick={() => onNavigate("home-markets")}>Markets</a>
            <a href="#fees" onClick={() => onNavigate("home-fees")}>Fees</a>
            <Link to="/settings" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Settings size={13} /> Settings
            </Link>
          </>
        )}
      </div>

      {!authed ? (
        <Link className="nav-cta" to="/signin">
          Sign in
        </Link>
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
