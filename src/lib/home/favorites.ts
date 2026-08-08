import {
  DEFAULT_FAVORITE_KEYS,
  HOME_MENU_KEYS,
  MAX_FAVORITE_COUNT,
  isHomeMenuKey,
  type HomeMenuKey,
} from "./menu";

export const FAVORITES_COOKIE_KEY = "home_favorite_menus";

export function normalizeFavoriteKeys(
  keys: readonly string[] | null | undefined
): HomeMenuKey[] {
  if (!keys || keys.length === 0) {
    return [...DEFAULT_FAVORITE_KEYS];
  }

  const seen = new Set<HomeMenuKey>();
  const normalized: HomeMenuKey[] = [];

  for (const key of keys) {
    if (!isHomeMenuKey(key) || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  const limited = normalized.slice(0, MAX_FAVORITE_COUNT);
  return limited.length > 0 ? limited : [...DEFAULT_FAVORITE_KEYS];
}

export function parseFavoriteKeys(
  raw: string | null | undefined
): HomeMenuKey[] {
  if (!raw?.trim()) {
    return [...DEFAULT_FAVORITE_KEYS];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_FAVORITE_KEYS];
    }
    return normalizeFavoriteKeys(
      parsed.filter((value): value is string => typeof value === "string")
    );
  } catch {
    const parts = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return normalizeFavoriteKeys(parts);
  }
}

export function serializeFavoriteKeys(keys: readonly HomeMenuKey[]): string {
  return JSON.stringify(normalizeFavoriteKeys(keys));
}

export function toggleFavoriteKey(
  current: readonly HomeMenuKey[],
  key: HomeMenuKey
): HomeMenuKey[] {
  if (current.includes(key)) {
    const next = current.filter((item) => item !== key);
    // Keep at least one favorite so the section never empties accidentally.
    return next.length > 0 ? next : current.slice();
  }

  const order = new Map(HOME_MENU_KEYS.map((item, index) => [item, index]));
  return normalizeFavoriteKeys([...current, key]).sort(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)
  );
}
