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
