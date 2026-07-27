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
  hq_location1?: string | null;
  hq_location2?: string | null;
  prepared?: boolean;
  prepared_at?: string | null;
  prepared_by?: string | null;
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
    qty: ((row.QTY ?? row.qty) as string | null) ?? null,
    ui: ((row.UI ?? row.ui) as string | null) ?? null,
    mtp: ((row.MTP ?? row.mtp) as string | null) ?? null,
    price: ((row.PRICE ?? row.price) as string | null) ?? null,
    amount: ((row.AMOUNT ?? row.amount) as string | null) ?? null,
    hq_location1: (row.hq_location1 as string | null | undefined) ?? null,
    hq_location2: (row.hq_location2 as string | null | undefined) ?? null,
    prepared:
      row.prepared === undefined ? undefined : Boolean(row.prepared),
    prepared_at: (row.prepared_at as string | null | undefined) ?? null,
    prepared_by: (row.prepared_by as string | null | undefined) ?? null,
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

  if (site === "SYP") {
    const { data, error } = await supabase.rpc("fn_po_syp_lines", {
      p_docno: docno,
    });
    if (error) throw error;
    const payload = data as { lines?: Record<string, unknown>[] } | null;
    return (payload?.lines ?? []).map(mapLine);
  }

  const { data, error } = await raw(supabase)
    .from(lineTable(site))
    .select("DOCNO, LINE, ITEMNO, BCODE, DETAIL, QTY, UI, MTP, PRICE, AMOUNT")
    .eq("DOCNO", docno)
    .order("LINE", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapLine);
}

async function syncHeaderPreparedFromLines(params: {
  supabase: SupabaseClient;
  docno: string;
  userId: string;
  note?: string | null;
}) {
  const { supabase, docno, userId, note } = params;
  const lines = await fetchPoLines({ supabase, site: "SYP", docno });
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
    if (currentLines.length > 0) {
      const linePayload = currentLines
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
    lines = await fetchPoLines({ supabase, site: "SYP", docno });
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
