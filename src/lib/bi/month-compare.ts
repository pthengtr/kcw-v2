export type BiMonthCompareRow = {
  key: string;
  label: string;
  sublabel?: string;
  total: number;
  /** Map of YYYY-MM → amount */
  months: Record<string, number>;
};

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

export function parseMonthColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

export function parseMonthCompareRows(value: unknown): BiMonthCompareRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const monthsRaw = (r.months ?? {}) as Record<string, unknown>;
    const months: Record<string, number> = {};
    for (const [period, amount] of Object.entries(monthsRaw)) {
      months[period] = asNumber(amount);
    }
    const sublabel = asString(r.sublabel).trim();
    return {
      key: asString(r.key),
      label: asString(r.label) || asString(r.key),
      sublabel: sublabel || undefined,
      total: asNumber(r.total),
      months,
    };
  });
}
