export const MAX_CUSTOM_BCODES = 12;

export function normalizeCategoryParam(
  raw: string | null | undefined
): string | null {
  const digits = (raw ?? "").replace(/\D/g, "").slice(0, 2);
  if (!digits) return null;
  const code = digits.padStart(2, "0");
  return /^\d{2}$/.test(code) ? code : null;
}

export function parseBcodesParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,+\s]+/)) {
    const bcode = part.trim();
    if (!bcode || seen.has(bcode)) continue;
    seen.add(bcode);
    out.push(bcode);
    if (out.length >= MAX_CUSTOM_BCODES) break;
  }
  return out;
}

export function serializeBcodesParam(bcodes: string[]): string {
  return parseBcodesParam(bcodes.join(",")).join(",");
}
