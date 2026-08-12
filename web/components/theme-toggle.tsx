"use client";

function nextTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  return current === "dark" ? "light" : "dark";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem("content-radar-theme", theme);
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={() => applyTheme(nextTheme())}
      className="theme-toggle"
      aria-label="Alternar tema claro ou escuro"
      title="Alternar tema claro ou escuro"
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__icon theme-toggle__icon--sun">☼</span>
        <span className="theme-toggle__icon theme-toggle__icon--moon">☾</span>
        <span className="theme-toggle__thumb" />
      </span>
    </button>
  );
}
