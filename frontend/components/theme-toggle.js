"use client";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const themeMeta = {
    system: {
      label: "System",
      icon: resolvedTheme === "dark" || resolvedTheme === "midnight" ? "desktop_windows" : "devices",
    },
    light: {
      label: "Light",
      icon: "light_mode",
    },
    "soft-light": {
      label: "Soft Light",
      icon: "wb_twilight",
    },
    dark: {
      label: "Dark",
      icon: "dark_mode",
    },
    midnight: {
      label: "Midnight",
      icon: "nights_stay",
    },
  };
  const currentTheme = themeMeta[theme] || themeMeta.system;

  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-primary/40 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-primary/50">
      <span
        className="material-symbols-outlined text-lg"
        style={theme !== "light" ? { fontVariationSettings: '"FILL" 1' } : undefined}
      >
        {currentTheme.icon}
      </span>
      <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:inline dark:text-slate-500">
        Theme
      </span>
      <select
        aria-label={`Choose theme. Current theme ${currentTheme.label}${theme === "system" ? ` resolved as ${resolvedTheme}` : ""}`}
        value={theme}
        onChange={(event) => setTheme(event.target.value)}
        className="min-w-[132px] bg-transparent pr-6 text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
      >
        {Object.entries(themeMeta).map(([value, item]) => (
          <option key={value} value={value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
