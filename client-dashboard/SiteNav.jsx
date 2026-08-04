import React, { useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, Settings, Menu, X } from "lucide-react";

// One shared nav for the whole site — marketing pages and the logged-in
// dashboard both render this, so there's a single consistent header instead
// of two apps with two different top bars. Adapts based on whether a client
// is currently authenticated. Uses real <Link> routes now instead of a
// custom onNavigate view-switcher, so every nav item is a real URL.
//
// Below 720px the old .nav-links rule was `display:none` with nothing to
// replace it — the entire nav (including Sign in / Dashboard / Log out)
// simply disappeared on mobile. This now renders a hamburger button that
// opens a slide-down menu with the same links instead of hiding them.
export default function SiteNav({ authed, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);

  function navigate(dest) {
    setOpen(false);
    onNavigate(dest);
  }

  const links = !authed ? (
    <>
      <a href="#how" onClick={() => navigate("home-how")}>How it works</a>
      <a href="#markets" onClick={() => navigate("home-markets")}>Markets</a>
      <a href="#fees" onClick={() => navigate("home-fees")}>Fees</a>
      <a href="#risk" onClick={() => navigate("home-risk")}>Risk</a>
    </>
  ) : (
    <>
      <Link to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
      <a href="#markets" onClick={() => navigate("home-markets")}>Markets</a>
      <a href="#fees" onClick={() => navigate("home-fees")}>Fees</a>
      <Link to="/settings" onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Settings size={13} /> Settings
      </Link>
    </>
  );

  const cta = !authed ? (
    <Link className="nav-cta" to="/signin" onClick={() => setOpen(false)}>
      Sign in
    </Link>
  ) : (
    <button
      className="nav-cta"
      onClick={() => {
        setOpen(false);
        onLogout();
      }}
      style={{ background: "transparent", border: "1px solid var(--panel-border)", color: "var(--bone)", display: "flex", alignItems: "center", gap: 6 }}
    >
      <LogOut size={13} /> Log out
    </button>
  );

  return (
    <nav className="site-nav">
      <Link className="brand" to="/" aria-label="GenesisX home" onClick={() => setOpen(false)}>
        <div className="brand-mark">₿</div>
        GenesisX
      </Link>

      <div className="nav-links">{links}</div>
      <div className="nav-cta-wrap">{cta}</div>

      <button
        className="nav-hamburger"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div className="nav-mobile-menu">
          <div className="nav-mobile-links">{links}</div>
          <div className="nav-mobile-cta">{cta}</div>
        </div>
      )}
    </nav>
  );
}
