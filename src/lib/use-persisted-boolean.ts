"use client";

import { useEffect, useState } from "react";

/** Client-only boolean persisted in localStorage (`"1"` / `"0"`). */
export function usePersistedBoolean(key: string, fallback = false) {
  const [value, setValue] = useState(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === "1" || raw === "true") setValue(true);
      else if (raw === "0" || raw === "false") setValue(false);
    } catch {
      // private mode / disabled storage
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // ignore
    }
  }, [key, value, hydrated]);

  return [value, setValue] as const;
}
