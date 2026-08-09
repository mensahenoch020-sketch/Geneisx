const STORAGE_KEY = "genesisx_theme";

// Marketing-site dark/light theme, backed by CSS variables in theme.css
// (:root = light default, [data-theme="dark"] = override). Scoped to the
// marketing pages only — the logged-in dashboard uses a separate JS COLORS
// object (dashboard/shared.jsx) that isn't wired to this yet; see the note
// where ThemeToggle is used in SiteNav.jsx.
export function getTheme() {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(STORAGE_KEY) || "light";
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function initTheme() {
  applyTheme(getTheme());
}
