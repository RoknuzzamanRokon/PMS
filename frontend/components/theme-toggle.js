"use client";

import { useTheme } from "./theme-provider";
import { useState, useRef, useEffect } from "react";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-primary/40 hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-primary/50 dark:hover:bg-slate-900"
      >
        <span
          className="material-symbols-outlined text-lg"
          style={theme !== "light" ? { fontVariationSettings: '"FILL" 1' } : undefined}
        >
          {currentTheme.icon}
        </span>
        <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:inline dark:text-slate-500">
          Theme
        </span>
        <div className="flex items-center gap-1 min-w-[100px] justify-between ml-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {currentTheme.label}
          </span>
          <span className={`material-symbols-outlined text-sm transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            keyboard_arrow_down
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="theme-panel absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-2xl border p-1 shadow-xl z-[100]">
          {Object.entries(themeMeta).map(([value, item]) => (
            <button
              key={value}
              onClick={() => {
                setTheme(value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                theme === value
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80"
              }`}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={theme === value ? { fontVariationSettings: '"FILL" 1' } : undefined}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
              {theme === value && (
                <span className="material-symbols-outlined ml-auto text-base">check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
