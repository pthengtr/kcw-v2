/**
 * Supabase Storage object keys are ASCII. A Thai character such as `ยอด`
 * makes the upload return `Invalid key` and nothing is saved.
 * https://supabase.com/docs/guides/storage/uploads/file-limits
 *
 * `displayName` keeps Thai so the queue and the Drive copy stay recognizable.
 * `storageName` is the object name under the format folder.
 */

const DISPLAY_UNSAFE = /[^\w.\-()\u0E00-\u0E7F]+/g;
const STORAGE_UNSAFE = /[^A-Za-z0-9._()-]+/g;

export type OnlineStatementNames = {
  displayName: string;
  storageName: string;
};

function stemOfXlsx(name: string): string | null {
  if (!name.toLowerCase().endsWith(".xlsx")) return null;
  return name.slice(0, -".xlsx".length);
}

function cleanStem(stem: string, unsafe: RegExp): string {
  const cleaned = stem
    .replace(unsafe, "_")
    .replace(/_+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[_.]+|[_.]+$/g, "");
  if (!cleaned || cleaned === "." || cleaned.includes("..")) return "statement";
  return cleaned.slice(0, 174);
}

export function onlineStatementNames(name: string): OnlineStatementNames | null {
  const base = name.split(/[/\\]/).pop()?.trim() ?? "";
  const rawStem = stemOfXlsx(base);
  if (rawStem === null) return null;

  const displayStem = cleanStem(rawStem, DISPLAY_UNSAFE);
  const storageStem = cleanStem(displayStem, STORAGE_UNSAFE);
  return {
    displayName: `${displayStem}.xlsx`,
    storageName: `${storageStem}.xlsx`,
  };
}

export function onlineStatementStoragePath(
  format: string,
  id: string,
  storageName: string
): string {
  return `${format}/${id}_${storageName}`;
}
