/**
 * KTB / bank Excel exports sometimes ship a truncated worksheet `!ref`
 * (e.g. A1:I12) while hundreds of cells exist beyond that range.
 * SheetJS trusts `!ref`, so only the first data row is imported.
 * Recompute the used range from actual cell addresses before sheet_to_json.
 */

/** Decode A1-style address (no $) to 0-based row/col. */
export function decodeCellA1(addr: string): { r: number; c: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(addr);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  let c = 0;
  for (let i = 0; i < letters.length; i++) {
    c = c * 26 + (letters.charCodeAt(i) - 64);
  }
  return { r: Number(m[2]) - 1, c: c - 1 };
}

/** Encode 0-based row/col to A1. */
export function encodeCellA1(r: number, c: number): string {
  let n = c + 1;
  let col = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return `${col}${r + 1}`;
}

export function encodeRangeA1(
  s: { r: number; c: number },
  e: { r: number; c: number },
): string {
  return `${encodeCellA1(s.r, s.c)}:${encodeCellA1(e.r, e.c)}`;
}

/**
 * Compute used range from sheet cell keys (ignores `!ref` / `!*` metadata keys).
 * Returns null when the sheet has no value cells.
 */
export function computeUsedRangeFromKeys(keys: string[]): string | null {
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -1;
  let maxC = -1;
  for (const key of keys) {
    if (!key || key.startsWith("!")) continue;
    const cell = decodeCellA1(key);
    if (!cell) continue;
    if (cell.r < minR) minR = cell.r;
    if (cell.c < minC) minC = cell.c;
    if (cell.r > maxR) maxR = cell.r;
    if (cell.c > maxC) maxC = cell.c;
  }
  if (maxR < 0 || !Number.isFinite(minR)) return null;
  return encodeRangeA1({ r: minR, c: minC }, { r: maxR, c: maxC });
}

/**
 * Expand worksheet `!ref` when stored dimension is smaller than actual cells.
 * Mutates `sheet` in place; safe no-op when already correct or empty.
 */
export function expandSheetRef(sheet: Record<string, unknown>): string | null {
  const computed = computeUsedRangeFromKeys(Object.keys(sheet));
  if (!computed) return (sheet["!ref"] as string | undefined) ?? null;

  const stated = typeof sheet["!ref"] === "string" ? (sheet["!ref"] as string) : null;
  if (!stated) {
    sheet["!ref"] = computed;
    return computed;
  }

  const statedEnd = stated.split(":")[1] || stated;
  const computedEnd = computed.split(":")[1] || computed;
  const se = decodeCellA1(statedEnd);
  const ce = decodeCellA1(computedEnd);
  if (!se || !ce) {
    sheet["!ref"] = computed;
    return computed;
  }
  // Prefer the larger envelope (union of stated + computed starts/ends).
  const statedStart = decodeCellA1(stated.split(":")[0] || stated);
  const computedStart = decodeCellA1(computed.split(":")[0] || computed);
  if (!statedStart || !computedStart) {
    sheet["!ref"] = computed;
    return computed;
  }
  const merged = encodeRangeA1(
    {
      r: Math.min(statedStart.r, computedStart.r),
      c: Math.min(statedStart.c, computedStart.c),
    },
    {
      r: Math.max(se.r, ce.r),
      c: Math.max(se.c, ce.c),
    },
  );
  sheet["!ref"] = merged;
  return merged;
}
