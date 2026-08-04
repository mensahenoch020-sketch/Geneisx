import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import SiteNav from "./SiteNav.jsx";
import MarketingSite from "./MarketingSite.jsx";
import LoginScreen from "./LoginScreen.jsx";
import SettingsPage from "./SettingsPage.jsx";
import { getToken, clearToken } from "./api.js";
import { AccountProvider } from "./dashboard/AccountContext.jsx";
import DashboardShell from "./dashboard/DashboardShell.jsx";
import OverviewPage from "./dashboard/pages/OverviewPage.jsx";
import PortfolioPage from "./dashboard/pages/PortfolioPage.jsx";
import WalletPage from "./dashboard/pages/WalletPage.jsx";
import WatchlistPage from "./dashboard/pages/WatchlistPage.jsx";
import TradePage from "./dashboard/pages/TradePage.jsx";
import TransactionsPage from "./dashboard/pages/TransactionsPage.jsx";
import InsightsPage from "./dashboard/pages/InsightsPage.jsx";
import AnalyticsPage from "./dashboard/pages/AnalyticsPage.jsx";
import MarketTrendsPage from "./dashboard/pages/MarketTrendsPage.jsx";
import SupportPage from "./dashboard/pages/SupportPage.jsx";

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
    <Routes>
      {/* Marketing + sign-in keep the top SiteNav. The dashboard section below
          is a completely different shell (sidebar, no top SiteNav) — mixing
          the two here (rather than always rendering SiteNav) is what makes
          the sidebar the dashboard's real navigation instead of a second nav
          bar stacked on top of it. */}
      <Route
        path="/"
        element={
          <>
            <SiteNav authed={authed} onNavigate={handleNavigate} onLogout={handleLoggedOut} />
            <MarketingSite onNavigate={handleNavigate} />
          </>
        }
      />
      <Route
        path="/signin"
        element={
          authed ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <>
              <SiteNav authed={authed} onNavigate={handleNavigate} onLogout={handleLoggedOut} />
              <LoginScreen onAuthenticated={handleAuthenticated} />
            </>
          )
        }
      />

      <Route
        path="/dashboard/*"
        element={
          <RequireAuth authed={authed}>
            <AccountProvider onLoggedOut={handleLoggedOut}>
              <DashboardShell onLoggedOut={handleLoggedOut}>
                <Routes>
                  <Route index element={<OverviewPage />} />
                  <Route path="portfolio" element={<PortfolioPage />} />
                  <Route path="wallet" element={<WalletPage />} />
                  <Route path="watchlist" element={<WatchlistPage />} />
                  <Route path="trade" element={<TradePage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route path="insights" element={<InsightsPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="market-trends" element={<MarketTrendsPage />} />
                  <Route path="support" element={<SupportPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </DashboardShell>
            </AccountProvider>
          </RequireAuth>
        }
      />

      <Route
        path="/settings"
        element={
          <RequireAuth authed={authed}>
            <AccountProvider onLoggedOut={handleLoggedOut}>
              <DashboardShell onLoggedOut={handleLoggedOut}>
                <SettingsPage />
              </DashboardShell>
            </AccountProvider>
          </RequireAuth>
        }
      />

      {/* Any unknown path falls back to the marketing homepage rather than a dead 404. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
