import React, { useState } from "react";
import SiteNav from "./SiteNav.jsx";
import MarketingSite from "./MarketingSite.jsx";
import LoginScreen from "./LoginScreen.jsx";
import ClientDashboard from "./client-dashboard.jsx";
import { getToken, clearToken } from "./api.js";

// One app, one nav, one auth gate — this replaces what used to be two
// separate apps (a static landing-page site and a standalone dashboard app
// living at /dashboard). Now everything lives at one URL, and the nav bar
// adapts based on whether a client is logged in, rather than sending people
// to a completely different app when they sign in.
export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken());
  const [view, setView] = useState("home"); // "home" | "signin" | "dashboard"

  function handleNavigate(dest) {
    if (dest === "dashboard") {
      setView("dashboard");
      return;
    }
    if (dest === "signin" || dest === "signup") {
      setView("signin");
      return;
    }
    if (dest === "home") {
      setView("home");
      return;
    }
    // Section anchors on the marketing page (e.g. "home-how", "home-markets")
    // — go to the marketing view and let it scroll to the right section.
    if (dest.startsWith("home-")) {
      setView("home");
      return;
    }
  }

  function handleAuthenticated() {
    setAuthed(true);
    setView("dashboard");
  }

  function handleLoggedOut() {
    clearToken();
    setAuthed(false);
    setView("home");
  }

  // Once logged in, default straight to the dashboard rather than the
  // marketing homepage — but marketing sections stay reachable via nav
  // (SiteNav still shows Markets/Fees links when authed).
  let content;
  if (view === "dashboard" && authed) {
    content = <ClientDashboard onLoggedOut={handleLoggedOut} />;
  } else if (view === "signin" && !authed) {
    content = <LoginScreen onAuthenticated={handleAuthenticated} />;
  } else {
    // "home" view, or a stale view left over from before logging out/in —
    // marketing content is always safe to show as the fallback.
    const section = view.startsWith("home-") ? view.replace("home-", "") : null;
    content = <MarketingSite onNavigate={handleNavigate} section={section} />;
  }

  return (
    <>
      <SiteNav authed={authed} onNavigate={handleNavigate} onLogout={handleLoggedOut} />
      {content}
    </>
  );
}
