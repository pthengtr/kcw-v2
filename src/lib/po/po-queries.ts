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

function headerTable(site: PoSyncSite) {
  return site === "HQ"
    ? "raw_hq_pomas_purchase_orders"
    : "raw_syp_pomas_purchase_orders";
}

function lineTable(site: PoSyncSite) {
  return site === "HQ"
    ? "raw_hq_podet_purchase_order_lines"
    : "raw_syp_podet_purchase_order_lines";
}

function mapHeader(row: Record<string, unknown>): PoHeaderRow {
  return {
    docno: String(row.DOCNO ?? ""),
    docdate: (row.DOCDATE as string | null) ?? null,
    acctno: (row.ACCTNO as string | null) ?? null,
    acctname: (row.ACCTNAME as string | null) ?? null,
    billed: (row.BILLED as string | null) ?? null,
    canceled: (row.CANCELED as string | null) ?? null,
    beforetax: (row.BEFORETAX as string | null) ?? null,
    tax: (row.TAX as string | null) ?? null,
    aftertax: (row.AFTERTAX as string | null) ?? null,
    billno: (row.BILLNO as string | null) ?? null,
    billdate: (row.BILLDATE as string | null) ?? null,
    remarks: (row.REMARKS as string | null) ?? null,
    ingested_at: (row._ingested_at as string | null) ?? null,
  };
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

function applyStatusFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  status: PoStatusFilter
) {
  if (status === "open") {
    return query.eq("BILLED", "N").neq("CANCELED", "Y");
  }
  if (status === "billed") {
    return query.eq("BILLED", "Y");
  }
  return query;
}

export async function fetchLastIngestedAt(
  supabase: SupabaseClient,
  site: PoSyncSite
): Promise<string | null> {
  const { data, error } = await raw(supabase)
    .from(headerTable(site))
    .select("_ingested_at")
    .order("_ingested_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  const row = (data ?? [])[0] as { _ingested_at?: string } | undefined;
  return row?._ingested_at ?? null;
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

  for (const site of sites) {
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
  }

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

  let preparedDocnos: string[] | null = null;
  if (site === "SYP" && prepareFilter !== "all") {
    const { data, error } = await supabase
      .from("po_syp_prepare")
      .select("docno")
      .eq("prepared", true);
    if (error) throw error;
    preparedDocnos = (data ?? []).map((r) => r.docno as string);
  }

  let query = raw(supabase)
    .from(headerTable(site))
    .select(
      "DOCNO, DOCDATE, ACCTNO, ACCTNAME, BILLED, CANCELED, BEFORETAX, TAX, AFTERTAX, BILLNO, BILLDATE, REMARKS, _ingested_at",
      { count: "exact" }
    );

  query = applyStatusFilter(query, status);

  if (q?.trim()) {
    const term = q.trim().replace(/[%(),]/g, "");
    if (term) {
      query = query.or(
        `DOCNO.ilike.%${term}%,ACCTNAME.ilike.%${term}%,ACCTNO.ilike.%${term}%`
      );
    }
  }

  if (site === "SYP" && preparedDocnos) {
    if (prepareFilter === "prepared") {
      if (preparedDocnos.length === 0) {
        return { rows: [], count: 0 };
      }
      query = query.in("DOCNO", preparedDocnos);
    } else if (prepareFilter === "not_prepared") {
      if (preparedDocnos.length > 0) {
        // PostgREST: not.in.(a,b)
        query = query.not(
          "DOCNO",
          "in",
          `(${preparedDocnos.map((d) => `"${d.replace(/"/g, "")}"`).join(",")})`
        );
      }
    }
  }

  const { data, error, count } = await query
    .order("DOCDATE", { ascending: false })
    .order("DOCNO", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const headers = ((data ?? []) as Record<string, unknown>[]).map(mapHeader);

  if (site !== "SYP" || headers.length === 0) {
    return { rows: headers, count: count ?? null };
  }

  const docnos = headers.map((h) => h.docno).filter(Boolean);
  const { data: prepareRows, error: prepareError } = await supabase
    .from("po_syp_prepare")
    .select("docno, prepared, prepared_at, prepared_by, note")
    .in("docno", docnos);

  if (prepareError) throw prepareError;

  const prepareMap = new Map(
    (prepareRows ?? []).map((r) => [
      r.docno as string,
      {
        prepared: Boolean(r.prepared),
        prepared_at: (r.prepared_at as string | null) ?? null,
        prepared_by: (r.prepared_by as string | null) ?? null,
        note: (r.note as string | null) ?? null,
      },
    ])
  );

  const rows = headers.map((h) => {
    const p = prepareMap.get(h.docno);
    return {
      ...h,
      prepared: p?.prepared ?? false,
      prepared_at: p?.prepared_at ?? null,
      prepared_by: p?.prepared_by ?? null,
      note: p?.note ?? null,
    };
  });

  return { rows, count: count ?? null };
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
