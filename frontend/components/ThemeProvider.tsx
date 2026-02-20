"use client";

/**
 * ThemeProvider — manages dark/warm theme toggle + time-of-day atmosphere.
 *
 * Theme: "cool" (default, deep blue-dark) | "warm" (deep amber-dark)
 * Saved in localStorage as "gpt-theme".
 *
 * Atmosphere: adds a CSS class to <html> based on current hour:
 *   morning (5–9), day (10–16), evening (17–21), night (22–4)
 * This drives subtle CSS overlay tints defined in globals.css.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Theme = "cool" | "warm";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "cool", toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

function getAtmosphere(hour: number): string {
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("cool");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Restore theme from localStorage
    const saved = localStorage.getItem("gpt-theme") as Theme | null;
    const initial: Theme = saved === "warm" ? "warm" : "cool";
    setTheme(initial);
    applyTheme(initial);

    // Set time-of-day atmosphere class
    const hour = new Date().getHours();
    const atmosphere = getAtmosphere(hour);
    const html = document.documentElement;
    html.classList.remove("morning", "day", "evening", "night");
    html.classList.add(atmosphere);

    setMounted(true);
  }, []);

  function applyTheme(t: Theme) {
    const html = document.documentElement;
    if (t === "warm") {
      html.classList.add("warm");
    } else {
      html.classList.remove("warm");
    }
  }

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "cool" ? "warm" : "cool";
      localStorage.setItem("gpt-theme", next);
      applyTheme(next);
      return next;
    });
  }, []);

  // Avoid hydration mismatch — render children immediately,
  // theme class is applied client-side via useEffect.
  return (
    <ThemeContext.Provider value={{ theme: mounted ? theme : "cool", toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
