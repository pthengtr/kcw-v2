import type { SupabaseClient } from "@supabase/supabase-js";

import {
  findInFlightIclowSync,
  findInFlightInventorySync,
  findInFlightPoRelatedSync,
  findInFlightPoSync,
  fetchIclowLastIngestedAt,
  fetchInventoryLastUpdatedAt,
  getWorkerHeartbeat,
  isWorkerOnline,
  workerNameForSite,
  type JobQueueRow,
  type PoSyncSite,
} from "./worker-jobs";

export type PoStatusFilter = "open" | "billed" | "all";
export type PoPrepareStatus = "not_prepared" | "partially_prepared" | "prepared";
export type PoPrepareFilter =
  | "all"
  | "prepared"
  | "partially_prepared"
  | "not_prepared";

export type PoHeaderRow = {
  docno: string;
  docdate: string | null;
  acctno: string | null;
  acctname: string | null;
  billed: string | null;
  canceled: string | null;
  beforetax: string | null;
  tax: string | null;
  aftertax: string | null;
  billno: string | null;
  billdate: string | null;
  remarks: string | null;
  ingested_at: string | null;
  /** Derived from HQ TF/TFV bills (SIMas REMARKS → PO docno). */
  prepared?: boolean;
  prepare_status?: PoPrepareStatus;
  tf_billnos?: string | null;
};

export type PoLineRow = {
  docno: string;
  line: string | null;
  itemno: string | null;
  bcode: string | null;
  detail: string | null;
  mcode: string | null;
  qty: string | null;
  ui: string | null;
  mtp: string | null;
  price: string | null;
  amount: string | null;
  hq_location1?: string | null;
  hq_location2?: string | null;
  hq_qty?: string | null;
  hq_qty_updated_at?: string | null;
  prepared?: boolean;
  prepare_line_status?: PoPrepareStatus;
  tf_qty?: number | string | null;
};

export type PoLinesResult = {
  lines: PoLineRow[];
  tf_billnos?: string | null;
};

function raw(supabase: SupabaseClient) {
  return supabase.schema("raw_kcw");
}

function lineTable(site: PoSyncSite) {
  return site === "HQ"
    ? "raw_hq_podet_purchase_order_lines"
    : "raw_syp_podet_purchase_order_lines";
}

function mapLine(row: Record<string, unknown>): PoLineRow {
  return {
    docno: String(row.DOCNO ?? row.docno ?? ""),
    line: ((row.LINE ?? row.line) as string | null) ?? null,
    itemno: ((row.ITEMNO ?? row.itemno) as string | null) ?? null,
    bcode: ((row.BCODE ?? row.bcode) as string | null) ?? null,
    detail: ((row.DETAIL ?? row.detail) as string | null) ?? null,
    mcode: ((row.MCODE ?? row.mcode) as string | null) ?? null,
    qty: ((row.QTY ?? row.qty) as string | null) ?? null,
    ui: ((row.UI ?? row.ui) as string | null) ?? null,
    mtp: ((row.MTP ?? row.mtp) as string | null) ?? null,
    price: ((row.PRICE ?? row.price) as string | null) ?? null,
    amount: ((row.AMOUNT ?? row.amount) as string | null) ?? null,
    hq_location1: (row.hq_location1 as string | null | undefined) ?? null,
    hq_location2: (row.hq_location2 as string | null | undefined) ?? null,
    hq_qty:
      row.hq_qty === undefined || row.hq_qty === null
        ? null
        : String(row.hq_qty),
    hq_qty_updated_at:
      (row.hq_qty_updated_at as string | null | undefined) ?? null,
    prepared:
      row.prepared === undefined ? undefined : Boolean(row.prepared),
    prepare_line_status: parsePrepareStatus(row.prepare_line_status),
    tf_qty:
      row.tf_qty === undefined || row.tf_qty === null
        ? null
        : Number(row.tf_qty),
  };
}

function parsePrepareStatus(value: unknown): PoPrepareStatus | undefined {
  const raw = String(value ?? "");
  if (
    raw === "not_prepared" ||
    raw === "partially_prepared" ||
    raw === "prepared"
  ) {
    return raw;
  }
  return undefined;
}

function mapRpcHeader(row: Record<string, unknown>): PoHeaderRow {
  return {
    docno: String(row.docno ?? ""),
    docdate: (row.docdate as string | null) ?? null,
    acctno: (row.acctno as string | null) ?? null,
    acctname: (row.acctname as string | null) ?? null,
    billed: (row.billed as string | null) ?? null,
    canceled: (row.canceled as string | null) ?? null,
    beforetax: (row.beforetax as string | null) ?? null,
    tax: (row.tax as string | null) ?? null,
    aftertax: (row.aftertax as string | null) ?? null,
    billno: (row.billno as string | null) ?? null,
    billdate: (row.billdate as string | null) ?? null,
    remarks: (row.remarks as string | null) ?? null,
    ingested_at: (row.ingested_at as string | null) ?? null,
    prepared:
      row.prepared === undefined ? undefined : Boolean(row.prepared),
    prepare_status: parsePrepareStatus(row.prepare_status),
    tf_billnos: (row.tf_billnos as string | null | undefined) ?? null,
  };
}

export async function fetchLastIngestedAt(
  supabase: SupabaseClient,
  site: PoSyncSite
): Promise<string | null> {
  const { data, error } = await supabase.rpc("fn_po_last_ingested_at", {
    p_site: site,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function fetchSimasLastIngestedAt(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase.rpc("fn_simas_last_ingested_at");
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function fetchPoMeta(supabase: SupabaseClient) {
  const sites: PoSyncSite[] = ["HQ", "SYP"];

  const siteEntries = await Promise.all(
    sites.map(async (site) => {
      const workerName = workerNameForSite(site);
      const [lastIngestedAt, heartbeat, inFlightJob] = await Promise.all([
        fetchLastIngestedAt(supabase, site),
        getWorkerHeartbeat(supabase, workerName),
        findInFlightPoSync(supabase, site),
      ]);
      return [
        site,
        {
          lastIngestedAt,
          workerName,
          workerOnline: isWorkerOnline(heartbeat?.last_seen ?? null),
          workerLastSeen: heartbeat?.last_seen ?? null,
          workerStatus: heartbeat?.status ?? null,
          inFlightJob,
        },
      ] as const;
    })
  );

  const [
    hqInventoryUpdatedAt,
    inventoryInFlight,
    hqIclowAt,
    sypIclowAt,
    iclowInFlight,
    poRelatedInFlight,
    simasLastIngestedAt,
  ] = await Promise.all([
    fetchInventoryLastUpdatedAt(supabase, "HQ"),
    findInFlightInventorySync(supabase),
    fetchIclowLastIngestedAt(supabase, "HQ"),
    fetchIclowLastIngestedAt(supabase, "SYP"),
    findInFlightIclowSync(supabase),
    findInFlightPoRelatedSync(supabase),
    fetchSimasLastIngestedAt(supabase),
  ]);

  return {
    sites: Object.fromEntries(siteEntries) as Record<
      PoSyncSite,
      {
        lastIngestedAt: string | null;
        workerName: string;
        workerOnline: boolean;
        workerLastSeen: string | null;
        workerStatus: string | null;
        inFlightJob: JobQueueRow | null;
      }
    >,
    inventory: {
      hqLastUpdatedAt: hqInventoryUpdatedAt,
      inFlightJobs: inventoryInFlight,
    },
    iclow: {
      hqLastIngestedAt: hqIclowAt,
      sypLastIngestedAt: sypIclowAt,
      inFlightJobs: iclowInFlight,
    },
    simas: {
      hqLastIngestedAt: simasLastIngestedAt,
    },
    poRelated: {
      inFlightJobs: poRelatedInFlight,
    },
  };
}

export async function listPoHeaders(params: {
  supabase: SupabaseClient;
  site: PoSyncSite;
  status?: PoStatusFilter;
  q?: string;
  from?: string;
  to?: string;
  months?: number;
  limit: number;
  offset: number;
  prepareFilter?: PoPrepareFilter;
}): Promise<{ rows: PoHeaderRow[]; count: number | null }> {
  const {
    supabase,
    site,
    status = "open",
    q,
    from,
    to,
    months = 1,
    limit,
    offset,
    prepareFilter = "all",
  } = params;

  const { data, error } = await supabase.rpc("fn_po_list", {
    p_site: site,
    p_status: status,
    p_prepare: site === "SYP" ? prepareFilter : "all",
    p_q: q?.trim() || null,
    p_from: from?.trim() || null,
    p_to: to?.trim() || null,
    p_months: months,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  const payload = data as
    | { rows?: Record<string, unknown>[]; count?: number | null }
    | null;

  const rows = (payload?.rows ?? []).map(mapRpcHeader);
  const count =
    payload?.count === null || payload?.count === undefined
      ? null
      : Number(payload.count);

  return { rows, count: Number.isFinite(count) ? count : null };
}

export async function fetchPoLines(params: {
  supabase: SupabaseClient;
  site: PoSyncSite;
  docno: string;
}): Promise<PoLinesResult> {
  const { supabase, site, docno } = params;

  if (site === "SYP") {
    const { data, error } = await supabase.rpc("fn_po_syp_lines", {
      p_docno: docno,
    });
    if (error) throw error;
    const payload = data as {
      lines?: Record<string, unknown>[];
      tf_billnos?: string | null;
    } | null;
    return {
      lines: (payload?.lines ?? []).map(mapLine),
      tf_billnos: payload?.tf_billnos ?? null,
    };
  }

  const { data, error } = await raw(supabase)
    .from(lineTable(site))
    .select(
      "DOCNO, LINE, ITEMNO, BCODE, DETAIL, MCODE, QTY, UI, MTP, PRICE, AMOUNT"
    )
    .eq("DOCNO", docno)
    .order("LINE", { ascending: true });

  if (error) throw error;
  return {
    lines: ((data ?? []) as Record<string, unknown>[]).map(mapLine),
  };
}

export const PO_PENDING_RECEIVE_STATUSES = [
  "to_be_ordered",
  "pending_receive",
  "partially_received",
  "complete",
] as const;

export type PoPendingReceiveStatus =
  (typeof PO_PENDING_RECEIVE_STATUSES)[number];

export const PO_ICLOW_STATUS_TABS: {
  value: PoPendingReceiveStatus;
  label: string;
}[] = [
  { value: "to_be_ordered", label: "รอสั่งซื้อ" },
  { value: "pending_receive", label: "ค้างรับ" },
  { value: "partially_received", label: "รับบางส่วน" },
];

export type PoPendingReceiveGrain = "line" | "docno" | "bcode";

export type PoPendingReceiveRow = {
  id: string;
  docno: string | null;
  docdate: string | null;
  vendor: string | null;
  acctname: string | null;
  bcode: string | null;
  descr: string | null;
  mcode: string | null;
  qty: number;
  ui: string | null;
  ordered: string | null;
  received: string | null;
  rcvddate: string | null;
  rcvdno: string | null;
  /** ICLOW.RCVDNO → PIMAS/PIDET (HQ) or SIMas/SIDet TF bill (SYP) */
  billno?: string | null;
  billdate?: string | null;
  /** HQ: true when at least one RCVDNO has no matching PIMAS bill */
  pimas_link_missing?: boolean;
  /** SYP: TF/TFV billnos contributing to received_qty (RCVDNO ∪ REMARKS) */
  tf_billnos?: string | null;
  status: PoPendingReceiveStatus;
  grain: PoPendingReceiveGrain;
  ordered_qty?: number;
  missing_qty?: number;
  received_qty?: number;
};

export type PoPendingReceiveDetailLine = {
  id?: string | null;
  docno?: string | null;
  docdate?: string | null;
  vendor?: string | null;
  bcode: string | null;
  descr: string | null;
  qty: number;
  ui: string | null;
  ordered?: string | null;
  received?: string | null;
  rcvddate?: string | null;
  rcvdno?: string | null;
};

export type PoPendingReceiveDetailReceived = {
  source: "pidet" | "iclow" | string;
  billno: string | null;
  billdate: string | null;
  bcode: string | null;
  descr: string | null;
  qty: number;
  ui: string | null;
  iclow_id: string | null;
  pimas_link_missing?: boolean;
};

export type PoPendingReceiveDetail = {
  docno: string;
  docdate: string | null;
  vendor: string | null;
  acctname: string | null;
  missing_count: number;
  received_iclow_count: number;
  received_display_count: number;
  missing: PoPendingReceiveDetailLine[];
  received: PoPendingReceiveDetailReceived[];
};

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapPendingReceiveRow(row: Record<string, unknown>): PoPendingReceiveRow {
  const statusRaw = String(row.status ?? "pending_receive");
  const status = (
    PO_PENDING_RECEIVE_STATUSES as readonly string[]
  ).includes(statusRaw)
    ? (statusRaw as PoPendingReceiveStatus)
    : "pending_receive";
  const grain: PoPendingReceiveGrain =
    row.grain === "docno" || row.grain === "po"
      ? "docno"
      : row.grain === "bcode"
        ? "bcode"
        : "line";

  return {
    id: String(row.id ?? `${row.docno ?? ""}|${row.bcode ?? ""}`),
    docno: (row.docno as string | null) ?? null,
    docdate: (row.docdate as string | null) ?? null,
    vendor: (row.vendor as string | null) ?? null,
    acctname: (row.acctname as string | null) ?? null,
    bcode: (row.bcode as string | null) ?? null,
    descr: (row.descr as string | null) ?? null,
    mcode: (row.mcode as string | null) ?? null,
    qty: num(row.qty),
    ui: (row.ui as string | null) ?? null,
    ordered: (row.ordered as string | null) ?? null,
    received: (row.received as string | null) ?? null,
    rcvddate: (row.rcvddate as string | null) ?? null,
    rcvdno: (row.rcvdno as string | null) ?? null,
    billno: (row.billno as string | null) ?? null,
    billdate: (row.billdate as string | null) ?? null,
    pimas_link_missing: Boolean(row.pimas_link_missing),
    tf_billnos: (row.tf_billnos as string | null | undefined) ?? null,
    status,
    grain,
    ordered_qty:
      row.ordered_qty === undefined ? undefined : num(row.ordered_qty),
    missing_qty:
      row.missing_qty === undefined ? undefined : num(row.missing_qty),
    received_qty:
      row.received_qty === undefined ? undefined : num(row.received_qty),
  };
}

export async function listPoPendingReceive(params: {
  supabase: SupabaseClient;
  site: PoSyncSite;
  status?: PoPendingReceiveStatus;
  q?: string;
  vendor?: string;
  from?: string;
  to?: string;
  months?: number;
  limit: number;
  offset: number;
}): Promise<{
  rows: PoPendingReceiveRow[];
  count: number | null;
  grain: PoPendingReceiveGrain;
}> {
  const {
    supabase,
    site,
    status = "pending_receive",
    q,
    vendor,
    from,
    to,
    months = 1,
    limit,
    offset,
  } = params;

  const { data, error } = await supabase.rpc("fn_po_pending_receive", {
    p_site: site,
    p_status: status,
    p_q: q?.trim() || null,
    p_vendor: vendor?.trim() || null,
    p_from: from?.trim() || null,
    p_to: to?.trim() || null,
    p_months: months,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  const payload = data as
    | {
        rows?: Record<string, unknown>[];
        count?: number | null;
        grain?: string;
      }
    | null;

  const rows = (payload?.rows ?? []).map(mapPendingReceiveRow);
  const count =
    payload?.count === null || payload?.count === undefined
      ? null
      : Number(payload.count);
  const grain: PoPendingReceiveGrain =
    payload?.grain === "docno" || payload?.grain === "po"
      ? "docno"
      : payload?.grain === "bcode"
        ? "bcode"
        : "line";

  return {
    rows,
    count: Number.isFinite(count) ? count : null,
    grain,
  };
}

export type PiHeader = {
  billno: string;
  billdate: string | null;
  acctno: string | null;
  acctname: string | null;
  po: string | null;
  aftertax: string | null;
  canceled: string | null;
  remarks: string | null;
  /** ICLOW RCVDNO when bill was resolved via left(BILLNO,12) */
  matched_rcvdno: string | null;
};

export type PiLineRow = {
  billno: string;
  bcode: string | null;
  detail: string | null;
  qty: string | null;
  ui: string | null;
  price: string | null;
  amount: string | null;
};

function billKey12(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .slice(0, 12);
}

/** Resolve ICLOW RCVDNO / PIMAS BILLNO and load PIDET lines (HQ purchase invoice). */
export async function fetchPiDetail(params: {
  supabase: SupabaseClient;
  billnoOrRcvdno: string;
}): Promise<{ header: PiHeader; lines: PiLineRow[] } | null> {
  // PARTS9 may pad BILLNO/RCVDNO with spaces and trunc RCVDNO to 12 chars.
  const key = params.billnoOrRcvdno.trim();
  if (!key) return null;
  const key12 = billKey12(key);

  const db = raw(params.supabase);

  let bill: Record<string, unknown> | null = null;
  let matchedRcvdno: string | null = null;

  const exact = await db
    .from("raw_hq_pimas_purchase_bills")
    .select('"BILLNO","BILLDATE","ACCTNO","PO","AFTERTAX","CANCELED","REMARKS"')
    .eq("BILLNO", key)
    .maybeSingle();
  if (exact.error) throw exact.error;
  bill = (exact.data as Record<string, unknown> | null) ?? null;

  if (!bill) {
    // Leading-space / truncated variants: scan a small candidate set, then
    // match on left(btrim(BILLNO),12) — same rule as fn_po_pending_receive.
    const prefix = await db
      .from("raw_hq_pimas_purchase_bills")
      .select('"BILLNO","BILLDATE","ACCTNO","PO","AFTERTAX","CANCELED","REMARKS"')
      .like("BILLNO", `%${key12}%`)
      .neq("CANCELED", "Y")
      .limit(40);
    if (prefix.error) throw prefix.error;
    const candidates = ((prefix.data as Record<string, unknown>[] | null) ?? [])
      .filter((row) => billKey12(String(row.BILLNO ?? "")) === key12)
      .sort((a, b) => {
        const aBill = String(a.BILLNO ?? "");
        const bBill = String(b.BILLNO ?? "");
        const aExact = aBill.trim() === key ? 0 : 1;
        const bExact = bBill.trim() === key ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        if (aBill.trim().length !== bBill.trim().length) {
          return aBill.trim().length - bBill.trim().length;
        }
        return aBill.localeCompare(bBill);
      });
    if (candidates.length > 0) {
      bill = candidates[0] ?? null;
      const resolved = String(bill?.BILLNO ?? "").trim();
      if (resolved !== key) matchedRcvdno = key;
    }
  }

  if (!bill) return null;

  // Keep raw BILLNO for PIDET join (PIDET often shares the same leading space).
  const billnoRaw = String(bill.BILLNO ?? key);
  const billno = billnoRaw.trim();
  const acctno = (bill.ACCTNO as string | null) ?? null;
  let acctname: string | null = null;
  if (acctno) {
    const ap = await db
      .from("raw_hq_apmas_payable")
      .select('"ACCTNAME"')
      .eq("ACCTNO", acctno)
      .maybeSingle();
    if (ap.error) throw ap.error;
    acctname =
      ((ap.data as Record<string, unknown> | null)?.ACCTNAME as string | null) ??
      null;
  }

  let linesRes = await db
    .from("raw_hq_pidet_purchase_lines")
    .select('"BILLNO","BCODE","DETAIL","QTY","UI","PRICE","AMOUNT","BILLTYPE","CANCELED"')
    .eq("BILLNO", billnoRaw)
    .in("BILLTYPE", ["1", "2", "3"])
    .limit(500);
  if (linesRes.error) throw linesRes.error;

  if (((linesRes.data as unknown[] | null) ?? []).length === 0 && billno !== billnoRaw) {
    linesRes = await db
      .from("raw_hq_pidet_purchase_lines")
      .select('"BILLNO","BCODE","DETAIL","QTY","UI","PRICE","AMOUNT","BILLTYPE","CANCELED"')
      .eq("BILLNO", billno)
      .in("BILLTYPE", ["1", "2", "3"])
      .limit(500);
    if (linesRes.error) throw linesRes.error;
  }

  const lines = ((linesRes.data as Record<string, unknown>[] | null) ?? [])
    .filter((row) => String(row.CANCELED ?? "") !== "Y")
    .map((row) => ({
      billno: String(row.BILLNO ?? billno).trim(),
      bcode: (row.BCODE as string | null) ?? null,
      detail: (row.DETAIL as string | null) ?? null,
      qty: row.QTY == null ? null : String(row.QTY),
      ui: (row.UI as string | null) ?? null,
      price: row.PRICE == null ? null : String(row.PRICE),
      amount: row.AMOUNT == null ? null : String(row.AMOUNT),
    }));

  return {
    header: {
      billno,
      billdate:
        bill.BILLDATE == null ? null : String(bill.BILLDATE).slice(0, 10),
      acctno,
      acctname: acctname ? String(acctname) : null,
      po: (bill.PO as string | null) ?? null,
      aftertax: bill.AFTERTAX == null ? null : String(bill.AFTERTAX),
      canceled: (bill.CANCELED as string | null) ?? null,
      remarks: (bill.REMARKS as string | null) ?? null,
      matched_rcvdno: matchedRcvdno,
    },
    lines,
  };
}

export async function fetchPoPendingReceiveDetail(params: {
  supabase: SupabaseClient;
  site: PoSyncSite;
  docno: string;
}): Promise<PoPendingReceiveDetail> {
  const { supabase, site, docno } = params;
  const { data, error } = await supabase.rpc("fn_po_pending_receive_detail", {
    p_site: site,
    p_docno: docno,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  const missingRaw = (payload.missing as Record<string, unknown>[] | null) ?? [];
  const receivedRaw =
    (payload.received as Record<string, unknown>[] | null) ?? [];

  return {
    docno: String(payload.docno ?? docno),
    docdate: (payload.docdate as string | null) ?? null,
    vendor: (payload.vendor as string | null) ?? null,
    acctname: (payload.acctname as string | null) ?? null,
    missing_count: num(payload.missing_count),
    received_iclow_count: num(payload.received_iclow_count),
    received_display_count: num(payload.received_display_count),
    missing: missingRaw.map((r) => ({
      id: (r.id as string | null) ?? null,
      docno: (r.docno as string | null) ?? null,
      docdate: (r.docdate as string | null) ?? null,
      vendor: (r.vendor as string | null) ?? null,
      bcode: (r.bcode as string | null) ?? null,
      descr: (r.descr as string | null) ?? null,
      qty: num(r.qty),
      ui: (r.ui as string | null) ?? null,
      ordered: (r.ordered as string | null) ?? null,
      received: (r.received as string | null) ?? null,
      rcvddate: (r.rcvddate as string | null) ?? null,
      rcvdno: (r.rcvdno as string | null) ?? null,
    })),
    received: receivedRaw.map((r) => ({
      source: String(r.source ?? "iclow"),
      billno: (r.billno as string | null) ?? null,
      billdate: (r.billdate as string | null) ?? null,
      bcode: (r.bcode as string | null) ?? null,
      descr: (r.descr as string | null) ?? null,
      qty: num(r.qty),
      ui: (r.ui as string | null) ?? null,
      iclow_id: (r.iclow_id as string | null) ?? null,
      pimas_link_missing: Boolean(r.pimas_link_missing),
    })),
  };
}

async function syncHeaderPreparedFromLines(params: {
  supabase: SupabaseClient;
  docno: string;
  userId: string;
  note?: string | null;
}) {
  const { supabase, docno, userId, note } = params;
  const { lines } = await fetchPoLines({ supabase, site: "SYP", docno });
  const allPrepared =
    lines.length > 0 && lines.every((line) => Boolean(line.prepared));
  await upsertSypPrepare({
    supabase,
    docno,
    prepared: allPrepared,
    note: note ?? null,
    userId,
  });
  return { allPrepared, lines };
}

export async function upsertSypPrepareLine(params: {
  supabase: SupabaseClient;
  docno: string;
  line: string;
  prepared: boolean;
  userId: string;
}): Promise<{
  line: {
    docno: string;
    line: string;
    prepared: boolean;
    prepared_at: string | null;
    prepared_by: string | null;
    updated_at: string;
  };
  headerPrepared: boolean;
  lines: PoLineRow[];
}> {
  const { supabase, docno, line, prepared, userId } = params;
  const now = new Date().toISOString();
  const payload = {
    docno,
    line,
    prepared,
    prepared_at: prepared ? now : null,
    prepared_by: prepared ? userId : null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("po_syp_prepare_line")
    .upsert(payload, { onConflict: "docno,line" })
    .select("docno, line, prepared, prepared_at, prepared_by, updated_at")
    .single();

  if (error) throw error;

  const synced = await syncHeaderPreparedFromLines({
    supabase,
    docno,
    userId,
  });

  return {
    line: data as {
      docno: string;
      line: string;
      prepared: boolean;
      prepared_at: string | null;
      prepared_by: string | null;
      updated_at: string;
    },
    headerPrepared: synced.allPrepared,
    lines: synced.lines,
  };
}

export async function upsertSypPrepare(params: {
  supabase: SupabaseClient;
  docno: string;
  prepared: boolean;
  note?: string | null;
  userId: string;
  /** When true, also set every PODET line prepare flag to match. */
  syncLines?: boolean;
}): Promise<{
  docno: string;
  prepared: boolean;
  prepared_at: string | null;
  prepared_by: string | null;
  note: string | null;
  updated_at: string;
  lines?: PoLineRow[];
}> {
  const { supabase, docno, prepared, note, userId, syncLines = false } = params;
  const now = new Date().toISOString();
  const payload = {
    docno,
    prepared,
    prepared_at: prepared ? now : null,
    prepared_by: prepared ? userId : null,
    note: note ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("po_syp_prepare")
    .upsert(payload, { onConflict: "docno" })
    .select("docno, prepared, prepared_at, prepared_by, note, updated_at")
    .single();

  if (error) throw error;

  let lines: PoLineRow[] | undefined;
  if (syncLines) {
    const currentLines = await fetchPoLines({ supabase, site: "SYP", docno });
    if (currentLines.lines.length > 0) {
      const linePayload = currentLines.lines
        .map((l) => l.line)
        .filter((line): line is string => Boolean(line))
        .map((line) => ({
          docno,
          line,
          prepared,
          prepared_at: prepared ? now : null,
          prepared_by: prepared ? userId : null,
          updated_at: now,
        }));
      if (linePayload.length > 0) {
        const { error: lineError } = await supabase
          .from("po_syp_prepare_line")
          .upsert(linePayload, { onConflict: "docno,line" });
        if (lineError) throw lineError;
      }
    }
    lines = (await fetchPoLines({ supabase, site: "SYP", docno })).lines;
  }

  return {
    ...(data as {
      docno: string;
      prepared: boolean;
      prepared_at: string | null;
      prepared_by: string | null;
      note: string | null;
      updated_at: string;
    }),
    lines,
  };
}

export type PoAccountDetail = {
  acctno: string;
  acctname: string | null;
  addr1: string | null;
  addr2: string | null;
  phone: string | null;
  /** APMAS MOBILE = tax id (not phone). */
  tax_id: string | null;
  fax: string | null;
  contact: string | null;
  email: string | null;
  term: string | null;
  remarks: string | null;
  canceled: string | null;
  /** Snapshot from the selected PO header when docno is provided. */
  po_snapshot: {
    docno: string;
    acctname: string | null;
    addr1: string | null;
    addr2: string | null;
    attn: string | null;
  } | null;
  source: "apmas" | "po_only";
};

function headerTable(site: PoSyncSite) {
  return site === "HQ"
    ? "raw_hq_pomas_purchase_orders"
    : "raw_syp_pomas_purchase_orders";
}

export async function fetchPoAccountDetail(params: {
  supabase: SupabaseClient;
  acctno: string;
  site: PoSyncSite;
  docno?: string | null;
}): Promise<PoAccountDetail | null> {
  const acctno = params.acctno.trim();
  if (!acctno) return null;

  const { data: apmas, error: apmasError } = await raw(params.supabase)
    .from("raw_hq_apmas_payable")
    .select(
      "ACCTNO, ACCTNAME, ADDR1, ADDR2, PHONE, MOBILE, FAX, CONTACT, EMAIL, TERM, REMARKS, CANCELED"
    )
    .eq("ACCTNO", acctno)
    .maybeSingle();
  if (apmasError) throw apmasError;

  let poSnapshot: PoAccountDetail["po_snapshot"] = null;
  if (params.docno?.trim()) {
    const { data: po, error: poError } = await raw(params.supabase)
      .from(headerTable(params.site))
      .select("DOCNO, ACCTNO, ACCTNAME, ADDR1, ADDR2, ATTN")
      .eq("DOCNO", params.docno.trim())
      .maybeSingle();
    if (poError) throw poError;
    if (po) {
      poSnapshot = {
        docno: String(po.DOCNO ?? params.docno),
        acctname: (po.ACCTNAME as string | null) ?? null,
        addr1: (po.ADDR1 as string | null) ?? null,
        addr2: (po.ADDR2 as string | null) ?? null,
        attn: (po.ATTN as string | null) ?? null,
      };
    }
  }

  if (!apmas && !poSnapshot) {
    return {
      acctno,
      acctname: null,
      addr1: null,
      addr2: null,
      phone: null,
      tax_id: null,
      fax: null,
      contact: null,
      email: null,
      term: null,
      remarks: null,
      canceled: null,
      po_snapshot: null,
      source: "po_only",
    };
  }

  if (!apmas) {
    return {
      acctno,
      acctname: poSnapshot?.acctname ?? null,
      addr1: poSnapshot?.addr1 ?? null,
      addr2: poSnapshot?.addr2 ?? null,
      phone: null,
      tax_id: null,
      fax: null,
      contact: null,
      email: null,
      term: null,
      remarks: null,
      canceled: null,
      po_snapshot: poSnapshot,
      source: "po_only",
    };
  }

  return {
    acctno: String(apmas.ACCTNO ?? acctno),
    acctname: (apmas.ACCTNAME as string | null) ?? poSnapshot?.acctname ?? null,
    addr1: (apmas.ADDR1 as string | null) ?? poSnapshot?.addr1 ?? null,
    addr2: (apmas.ADDR2 as string | null) ?? poSnapshot?.addr2 ?? null,
    phone: (apmas.PHONE as string | null) ?? null,
    tax_id: (apmas.MOBILE as string | null) ?? null,
    fax: (apmas.FAX as string | null) ?? null,
    contact: (apmas.CONTACT as string | null) ?? null,
    email: (apmas.EMAIL as string | null) ?? null,
    term: apmas.TERM != null ? String(apmas.TERM) : null,
    remarks: (apmas.REMARKS as string | null) ?? null,
    canceled: (apmas.CANCELED as string | null) ?? null,
    po_snapshot: poSnapshot,
    source: "apmas",
  };
}
