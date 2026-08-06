import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  SlidersHorizontal,
  Wallet as WalletIcon,
  Pin,
  ArrowLeftRight,
  LineChart,
  BarChart3,
  TrendingUp as TrendingUpIcon,
  Headphones,
  Settings as SettingsIcon,
  LogOut,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import { useAccount } from "./AccountContext.jsx";
import NotificationBell from "./NotificationBell.jsx";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", icon: LayoutGrid, label: "Dashboard", end: true }],
  },
  {
    label: "Account",
    items: [
      { to: "/dashboard/portfolio", icon: SlidersHorizontal, label: "Portfolio" },
      { to: "/dashboard/wallet", icon: WalletIcon, label: "Wallet" },
      { to: "/dashboard/watchlist", icon: Pin, label: "Watchlist" },
    ],
  },
  {
    label: "Activity",
    items: [{ to: "/dashboard/transactions", icon: ArrowLeftRight, label: "Transactions" }],
  },
  {
    label: "Insights",
    items: [
      { to: "/dashboard/insights", icon: LineChart, label: "Insights" },
      { to: "/dashboard/analytics", icon: BarChart3, label: "Analytics", badge: "Beta" },
      { to: "/dashboard/market-trends", icon: TrendingUpIcon, label: "Market Trends" },
    ],
  },
  {
    label: "Others",
    items: [
      { to: "/dashboard/support", icon: Headphones, label: "Support" },
      { to: "/settings", icon: SettingsIcon, label: "Settings" },
    ],
  },
];

function firstName(name) {
  if (!name) return "";
  return name.trim().split(/\s+/)[0];
}

export default function DashboardShell({ onLoggedOut, children }) {
  const { client } = useAccount();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function go(to) {
    setMobileOpen(false);
    navigate(to);
  }

  return (
    <div className={`dash-shell ${collapsed ? "is-collapsed" : ""}`}>
      {/* Mobile top bar — this is what was missing entirely on small screens,
          since the old marketing SiteNav's .nav-links just display:none'd
          below 720px with nothing to replace it. */}
      <div className="dash-mobile-bar">
        <button className="dash-icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="dash-mobile-brand">
          <span className="brand-mark">₿</span> GenesisX
        </div>
        <div style={{ width: 36 }} />
      </div>

      {mobileOpen && <div className="dash-scrim" onClick={() => setMobileOpen(false)} />}

      <aside className={`dash-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="dash-sidebar-top">
          <button className="brand dash-brand" onClick={() => go("/dashboard")}>
            <div className="brand-mark">₿</div>
            {!collapsed && (
              <div>
                <div className="dash-brand-name">GenesisX</div>
                <div className="dash-brand-sub">Actively Managed Bitcoin</div>
              </div>
            )}
          </button>
          <button
            className="dash-icon-btn dash-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft size={16} style={{ transform: collapsed ? "rotate(180deg)" : "none" }} />
          </button>
          <button className="dash-icon-btn dash-close-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {!collapsed && (
          <div className="dash-welcome">
            <div className="dash-welcome-title">Welcome Back{client ? `, ${firstName(client.name)}` : ""}</div>
          </div>
        )}

        <nav className="dash-nav">
          {NAV_GROUPS.map((group) => (
            <div className="dash-nav-group" key={group.label}>
              {!collapsed && <div className="dash-nav-label">{group.label}</div>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `dash-nav-item ${isActive ? "is-active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={17} strokeWidth={1.8} />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.badge && <span className="dash-nav-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="dash-sidebar-bottom">
          <button
            className="dash-logout-btn"
            onClick={() => {
              if (window.confirm("Log out of GenesisX?")) onLoggedOut();
            }}
            title={collapsed ? "Log out" : undefined}
          >
            <LogOut size={17} strokeWidth={2} />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      <div className="dash-content">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <NotificationBell />
        </div>
        {children}
      </div>
    </div>
  );
}
