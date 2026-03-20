"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

const storageKey = "inno-rooms-theme";
const themeOrder = ["system", "light", "soft-light", "dark", "midnight"];

function applyTheme(theme) {
  if (typeof document === "undefined") {
    return "light";
  }

  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme =
    theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  const root = document.documentElement;
  const isDarkFamily = resolvedTheme === "dark" || resolvedTheme === "midnight";

  root.classList.toggle("dark", isDarkFamily);
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = isDarkFamily ? "dark" : "light";

  return resolvedTheme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("system");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKey) || "system";
    setThemeState(savedTheme);
    setResolvedTheme(applyTheme(savedTheme));

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setResolvedTheme(applyTheme(window.localStorage.getItem(storageKey) || "system"));
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  function setTheme(nextTheme) {
    setThemeState(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
    setResolvedTheme(applyTheme(nextTheme));
  }

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme: () => {
        const currentIndex = themeOrder.indexOf(theme);
        const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
        setTheme(nextTheme);
      },
    }),
    [resolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
