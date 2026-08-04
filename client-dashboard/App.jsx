import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import SiteNav from "./SiteNav.jsx";
import MarketingSite from "./MarketingSite.jsx";
import LoginScreen from "./LoginScreen.jsx";
import ClientDashboard from "./client-dashboard.jsx";
import SettingsPage from "./SettingsPage.jsx";
import { getToken, clearToken } from "./api.js";

// Real routes now instead of useState view-switching — marketing, sign in,
// dashboard, and settings each have their own URL, so refresh/back-button/
// direct links all work like an actual website instead of one page that
// silently swaps its contents.

function RequireAuth({ authed, children }) {
  const location = useLocation();
  if (!authed) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }
  return children;
}

function AppShell({ authed, setAuthed }) {
  const navigate = useNavigate();

  function handleAuthenticated() {
    setAuthed(true);
    navigate("/dashboard");
  }

  function handleLoggedOut() {
    clearToken();
    setAuthed(false);
    navigate("/");
  }

  // SiteNav's marketing-section links (#how, #markets, #fees, #risk) still
  // work as plain anchors when already on "/", and route back to "/" first
  // (via a normal Link-less href) when navigated from elsewhere.
  function handleNavigate(dest) {
    if (dest === "dashboard") return navigate("/dashboard");
    if (dest === "signin" || dest === "signup") return navigate("/signin");
    if (dest === "home") return navigate("/");
    if (dest.startsWith("home-")) {
      const section = dest.replace("home-", "");
      navigate(`/#${section}`);
    }
  }

  return (
    <>
      <SiteNav authed={authed} onNavigate={handleNavigate} onLogout={handleLoggedOut} />
      <Routes>
        <Route path="/" element={<MarketingSite onNavigate={handleNavigate} />} />
        <Route
          path="/signin"
          element={authed ? <Navigate to="/dashboard" replace /> : <LoginScreen onAuthenticated={handleAuthenticated} />}
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth authed={authed}>
              <ClientDashboard onLoggedOut={handleLoggedOut} />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth authed={authed}>
              <SettingsPage />
            </RequireAuth>
          }
        />
        {/* Any unknown path falls back to the marketing homepage rather than a dead 404. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  const [authed, setAuthed] = React.useState(() => !!getToken());
  return (
    <BrowserRouter>
      <AppShell authed={authed} setAuthed={setAuthed} />
    </BrowserRouter>
  );
}
