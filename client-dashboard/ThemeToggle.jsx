import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getTheme, setTheme } from "./theme.js";

export default function ThemeToggle({ style }) {
  const [theme, setThemeState] = useState(getTheme());

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  return (
    <button
      onClick={() => setThemeState((t) => (t === "dark" ? "light" : "dark"))}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        background: "transparent",
        border: "1px solid var(--panel-border)",
        borderRadius: 7,
        width: 34,
        height: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--bone)",
        cursor: "pointer",
        flexShrink: 0,
        ...style,
      }}
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
