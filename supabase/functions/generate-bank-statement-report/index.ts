/**
 * Generate monthly multi-account bank statement Excel report.
 *
 * Auth: signed-in user with RBAC page `bank_statement_sync` (or admin role).
 * Body JSON (optional fields):
 *   - year: number (default: Bangkok today − 10 days)
 *   - month: number 1-12
 *
 * Reads bank.statement_lines (live match_* fields), builds VAT-style workbook
 * (one sheet per account), uploads to Storage bucket `bank-statements` under
 * `reports/{year}/{mm}/…`, returns a signed download URL. No Google Drive.
 *
 * Layout parity: kcw-analytics `src/kcw/bank_statement_report.py`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireBankStatementSyncPermission } from "../_shared/rbac-auth.ts";
import { corsHeaders } from "./cors.ts";
import {
  buildAccountSheets,
  buildWorkbookBuffer,
  enrichStatementRows,
  matchStatusCounts,
  monthBounds,
  reportingYearMonth,
  type StatementLineRow,
} from "./report.ts";

const BUCKET = "bank-statements";
const SIGNED_URL_SECONDS = 60 * 60; // 1 hour
const PAGE_SIZE = 1000;

type ReportStatus = "generated" | "failed";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing Authorization bearer token" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser(token);
    if (userErr || !user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const email = (user.email ?? "").trim().toLowerCase();
    if (!email) {
      return jsonResponse({ error: "User email required" }, 403);
    }

    const perm = await requireBankStatementSyncPermission(admin, user.id);
    if (!perm.ok) {
      return jsonResponse({ error: perm.message }, perm.status);
    }

    let body: Record<string, unknown> = {};
    const ct = req.headers.get("content-type") ?? "";
    if (ct.toLowerCase().includes("application/json")) {
      try {
        const parsed = await req.json();
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          body = parsed as Record<string, unknown>;
        }
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }
    }

    const defaults = reportingYearMonth();
    const year =
      body.year == null || body.year === ""
        ? defaults.year
        : Number(body.year);
    const month =
      body.month == null || body.month === ""
        ? defaults.month
        : Number(body.month);

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return jsonResponse({ error: "year must be an integer 2000-2100" }, 400);
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return jsonResponse({ error: "month must be an integer 1-12" }, 400);
    }

    const { start, end } = monthBounds(year, month);
    const lines = await loadStatementLines(admin, start, end);

    if (lines.length === 0) {
      return jsonResponse(
        {
          status: "failed" satisfies ReportStatus,
          error: `No bank.statement_lines for ${year}-${String(month).padStart(2, "0")}. Import statements first.`,
          year,
          month,
          row_count: 0,
        },
        404,
      );
    }

    const enriched = enrichStatementRows(lines);
    const sheets = buildAccountSheets(enriched);
    const counts = matchStatusCounts(enriched);
    const bytes = await buildWorkbookBuffer(sheets, year, month);

    const mm = String(month).padStart(2, "0");
    const filename = `bank_statement_report_${year}_${mm}.xlsx`;
    const storagePath = `reports/${year}/${mm}/${filename}`;
    const contentType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const { error: upErr } = await admin.storage.from(BUCKET).upload(
      storagePath,
      bytes,
      { contentType, upsert: true },
    );
    if (upErr) {
      console.error("storage upload failed", upErr);
      return jsonResponse(
        {
          status: "failed" satisfies ReportStatus,
          error: `Storage upload failed: ${upErr.message}`,
          year,
          month,
          row_count: lines.length,
        },
        500,
      );
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      console.error("signed url failed", signErr);
      return jsonResponse(
        {
          status: "failed" satisfies ReportStatus,
          error: signErr?.message ?? "Could not create signed download URL",
          year,
          month,
          bucket: BUCKET,
          storage_path: storagePath,
          row_count: lines.length,
        },
        500,
      );
    }

    return jsonResponse({
      status: "generated" satisfies ReportStatus,
      year,
      month,
      filename,
      bucket: BUCKET,
      storage_path: storagePath,
      signed_url: signed.signedUrl,
      signed_url_expires_in: SIGNED_URL_SECONDS,
      row_count: lines.length,
      sheet_names: [...sheets.keys()],
      match_status_counts: counts,
      generated_by: email,
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: msg }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function loadStatementLines(
  admin: any,
  start: string,
  end: string,
): Promise<StatementLineRow[]> {
  const bank = admin.schema("bank");
  const all: StatementLineRow[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await bank
      .from("statement_lines")
      .select(
        `
        account_no,
        bank_name,
        txn_date,
        value_date,
        description,
        bank_reference,
        amount,
        direction,
        debit,
        credit,
        balance_after,
        raw_json,
        source_row_number,
        source_file_id,
        match_status,
        match_reason,
        match_notes,
        matched_ref_type,
        matched_ref_id,
        match_confidence,
        statement_import_files!source_file_id ( original_filename )
      `,
      )
      .gte("txn_date", start)
      .lt("txn_date", end)
      .order("account_no", { ascending: true })
      .order("txn_date", { ascending: true })
      .order("source_row_number", { ascending: true, nullsFirst: false })
      .range(from, to);

    if (error) throw error;
    const chunk = (data ?? []) as Array<
      Record<string, unknown> & {
        statement_import_files?:
          | { original_filename?: string | null }
          | { original_filename?: string | null }[]
          | null;
      }
    >;

    for (const row of chunk) {
      const fileRel = row.statement_import_files;
      const fileObj = Array.isArray(fileRel) ? fileRel[0] : fileRel;
      all.push({
        account_no: (row.account_no as string | null) ?? null,
        bank_name: (row.bank_name as string | null) ?? null,
        txn_date: (row.txn_date as string | null) ?? null,
        value_date: (row.value_date as string | null) ?? null,
        description: (row.description as string | null) ?? null,
        bank_reference: (row.bank_reference as string | null) ?? null,
        amount: (row.amount as number | null) ?? null,
        direction: (row.direction as string | null) ?? null,
        debit: (row.debit as number | null) ?? null,
        credit: (row.credit as number | null) ?? null,
        balance_after: (row.balance_after as number | null) ?? null,
        raw_json: row.raw_json,
        source_row_number: (row.source_row_number as number | null) ?? null,
        source_file_id: (row.source_file_id as string | null) ?? null,
        match_status: (row.match_status as string | null) ?? null,
        match_reason: (row.match_reason as string | null) ?? null,
        match_notes: (row.match_notes as string | null) ?? null,
        matched_ref_type: (row.matched_ref_type as string | null) ?? null,
        matched_ref_id: (row.matched_ref_id as string | null) ?? null,
        match_confidence: (row.match_confidence as number | null) ?? null,
        original_filename: fileObj?.original_filename ?? null,
      });
    }

    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
