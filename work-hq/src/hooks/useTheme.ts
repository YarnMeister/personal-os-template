import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "work-hq:theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored =
      (typeof window !== "undefined" &&
        (window.localStorage.getItem(KEY) as Theme | null)) ||
      "dark";
    setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  return {
    theme,
    setTheme,
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
}
