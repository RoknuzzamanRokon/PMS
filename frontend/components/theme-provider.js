"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

const storageKey = "inno-rooms-theme";
const themeOrder = ["light", "soft-light", "dark", "midnight"];

function applyTheme(theme) {
  if (typeof document === "undefined") {
    return "light";
  }

  const resolvedTheme = theme === "system" || !theme ? "light" : theme;
  const root = document.documentElement;
  const isDarkFamily = resolvedTheme === "dark" || resolvedTheme === "midnight";

  // Explicitly add or remove — never rely on toggle with OS state
  if (isDarkFamily) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = isDarkFamily ? "dark" : "light";

  return resolvedTheme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKey) || "light";
    const normalizedTheme =
      savedTheme === "system" || !savedTheme ? "light" : savedTheme;
    setThemeState(normalizedTheme);
    setResolvedTheme(applyTheme(normalizedTheme));

    // Only respond to OS changes if user hasn't explicitly picked a theme
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    function handleOsChange() {
      const current = window.localStorage.getItem(storageKey);
      // If user has an explicit saved theme, ignore OS changes
      if (current && current !== "system") return;
      applyTheme("light");
    }
    mediaQuery.addEventListener("change", handleOsChange);
    return () => mediaQuery.removeEventListener("change", handleOsChange);
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

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
