"use server";

import { setMyCookie } from "@/app/(root)/action";
import {
  FAVORITES_COOKIE_KEY,
  normalizeFavoriteKeys,
  serializeFavoriteKeys,
} from "@/lib/home/favorites";
import type { HomeMenuKey } from "@/lib/home/menu";

export async function saveHomeFavoriteKeys(keys: HomeMenuKey[]) {
  const normalized = normalizeFavoriteKeys(keys);
  await setMyCookie(FAVORITES_COOKIE_KEY, serializeFavoriteKeys(normalized));
  return normalized;
}
