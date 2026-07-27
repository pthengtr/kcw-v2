import type { SupabaseClient } from "@supabase/supabase-js";

import {
  findInFlightPoSync,
  getWorkerHeartbeat,
  isWorkerOnline,
  workerNameForSite,
  type JobQueueRow,
  type PoSyncSite,
} from "./worker-jobs";

export type PoStatusFilter = "open" | "billed" | "all";
export type PoPrepareFilter = "all" | "prepared" | "not_prepared";

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
  prepared?: boolean;
  prepared_at?: string | null;
  prepared_by?: string | null;
  note?: string | null;
};

export type PoLineRow = {
  docno: string;
  line: string | null;
  itemno: string | null;
  bcode: string | null;
  detail: string | null;
  qty: string | null;
  ui: string | null;
  mtp: string | null;
  price: string | null;
  amount: string | null;
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
    docno: String(row.DOCNO ?? ""),
    line: (row.LINE as string | null) ?? null,
    itemno: (row.ITEMNO as string | null) ?? null,
    bcode: (row.BCODE as string | null) ?? null,
    detail: (row.DETAIL as string | null) ?? null,
    qty: (row.QTY as string | null) ?? null,
    ui: (row.UI as string | null) ?? null,
    mtp: (row.MTP as string | null) ?? null,
    price: (row.PRICE as string | null) ?? null,
    amount: (row.AMOUNT as string | null) ?? null,
  };
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
    prepared_at: (row.prepared_at as string | null | undefined) ?? null,
    prepared_by: (row.prepared_by as string | null | undefined) ?? null,
    note: (row.note as string | null | undefined) ?? null,
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

export async function fetchPoMeta(supabase: SupabaseClient) {
  const sites: PoSyncSite[] = ["HQ", "SYP"];
  const result: Record<
    PoSyncSite,
    {
      lastIngestedAt: string | null;
      workerName: string;
      workerOnline: boolean;
      workerLastSeen: string | null;
      workerStatus: string | null;
      inFlightJob: JobQueueRow | null;
    }
  > = {
    HQ: {
      lastIngestedAt: null,
      workerName: "HQ-PC",
      workerOnline: false,
      workerLastSeen: null,
      workerStatus: null,
      inFlightJob: null,
    },
    SYP: {
      lastIngestedAt: null,
      workerName: "SYP-PC",
      workerOnline: false,
      workerLastSeen: null,
      workerStatus: null,
      inFlightJob: null,
    },
  };

  await Promise.all(
    sites.map(async (site) => {
      const workerName = workerNameForSite(site);
      const [lastIngestedAt, heartbeat, inFlightJob] = await Promise.all([
        fetchLastIngestedAt(supabase, site),
        getWorkerHeartbeat(supabase, workerName),
        findInFlightPoSync(supabase, site),
      ]);
      result[site] = {
        lastIngestedAt,
        workerName,
        workerOnline: isWorkerOnline(heartbeat?.last_seen ?? null),
        workerLastSeen: heartbeat?.last_seen ?? null,
        workerStatus: heartbeat?.status ?? null,
        inFlightJob,
      };
    })
  );

  return result;
}

export async function listPoHeaders(params: {
  supabase: SupabaseClient;
  site: PoSyncSite;
  status?: PoStatusFilter;
  q?: string;
  limit: number;
  offset: number;
  prepareFilter?: PoPrepareFilter;
}): Promise<{ rows: PoHeaderRow[]; count: number | null }> {
  const {
    supabase,
    site,
    status = "open",
    q,
    limit,
    offset,
    prepareFilter = "all",
  } = params;

  const { data, error } = await supabase.rpc("fn_po_list", {
    p_site: site,
    p_status: status,
    p_prepare: site === "SYP" ? prepareFilter : "all",
    p_q: q?.trim() || null,
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
}): Promise<PoLineRow[]> {
  const { supabase, site, docno } = params;
  const { data, error } = await raw(supabase)
    .from(lineTable(site))
    .select("DOCNO, LINE, ITEMNO, BCODE, DETAIL, QTY, UI, MTP, PRICE, AMOUNT")
    .eq("DOCNO", docno)
    .order("LINE", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapLine);
}

export async function upsertSypPrepare(params: {
  supabase: SupabaseClient;
  docno: string;
  prepared: boolean;
  note?: string | null;
  userId: string;
}): Promise<{
  docno: string;
  prepared: boolean;
  prepared_at: string | null;
  prepared_by: string | null;
  note: string | null;
  updated_at: string;
}> {
  const { supabase, docno, prepared, note, userId } = params;
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
  return data as {
    docno: string;
    prepared: boolean;
    prepared_at: string | null;
    prepared_by: string | null;
    note: string | null;
    updated_at: string;
  };
}
