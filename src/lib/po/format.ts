export function formatPoTs(value: string | null | undefined) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("th-TH");
}

export function formatPoAmount(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPoQty(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("th-TH", {
    maximumFractionDigits: 3,
  });
}

export function formatPoDate(value: string | null | undefined) {
  if (!value) return "—";
  // DOCDATE often comes as YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("th-TH");
}

export function billedLabel(billed: string | null | undefined) {
  if (billed === "Y") return "รับแล้ว";
  if (billed === "N") return "เปิด";
  return billed ?? "—";
}

/** Default ICLOW list window — keep queries under statement_timeout. */
export function last30DaysPoDateRange(now = new Date()): {
  from: string;
  to: string;
} {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { from: iso(from), to: iso(to) };
}
