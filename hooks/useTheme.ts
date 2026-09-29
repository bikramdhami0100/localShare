"use client";

import { useCallback, useEffect, useState } from "react";

// Light/dark theme following Simple.Savr's approach: system by default,
// override stored in localStorage. Styling-only preference (allowed).
export function useTheme() {
  const [dark, setDark] = useState<boolean>(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      document.documentElement.style.colorScheme = next ? "dark" : "light";
      try {
        localStorage.setItem("localshare-theme", next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { dark, toggle };
}