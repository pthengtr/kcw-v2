export type ToBillStatus = "draft" | "issued" | "void";

export type ToBillRef = {
  tad_billno: string;
  docno: string | null;
  status: ToBillStatus;
  invoice_id?: string;
  doc_kind?: string | null;
};

export function isReceiptToBill(row: {
  doc_kind?: string | null;
  docno?: string | null;
}): boolean {
  if (row.doc_kind === "rvo") return true;
  return (row.docno ?? "").trim().toUpperCase().startsWith("RVO");
}

export function isHqTadBillno(billno: string): boolean {
  return billno.trim().toUpperCase().startsWith("TAD");
}

export function toBillCoverage(
  billnos: string[],
  byBill: Record<string, { status?: string } | undefined>
): { issued: number; total: number } {
  const seen = new Set<string>();
  const tad: string[] = [];
  for (const raw of billnos) {
    const bill = raw.trim().toUpperCase();
    if (!isHqTadBillno(bill) || seen.has(bill)) continue;
    seen.add(bill);
    tad.push(bill);
  }
  const issued = tad.filter((bill) => byBill[bill]?.status === "issued").length;
  return { issued, total: tad.length };
}

export function toBillCoverageLabel(coverage: {
  issued: number;
  total: number;
}): string | null {
  if (coverage.total === 0) return null;
  return `ใบเต็ม ${coverage.issued}/${coverage.total}`;
}

export function toBillCreateHref(
  baseUrl: string,
  billno: string,
  kind?: "to" | "rvo"
): string {
  const base = baseUrl.replace(/\/$/, "");
  const tad = `${base}/to-bill/?tad=${encodeURIComponent(billno.trim())}`;
  return kind === "rvo" ? `${tad}&kind=rvo` : tad;
}
