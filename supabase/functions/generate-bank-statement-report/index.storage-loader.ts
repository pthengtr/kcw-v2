/**
 * Tiny Edge entrypoint for environments where full multi-file deploy is blocked
 * (e.g. MCP payload truncation). Deploy THIS file as `index.ts` via MCP, after
 * uploading the bundle from `build-storage-bundle.mjs --upload`.
 *
 * Prefer deploying the real multi-file sources (`index.ts` + helpers) with
 * `supabase functions deploy` when CLI auth works.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import ExcelJS from "npm:exceljs@4.4.0";

const BUNDLE_PATH = "reports/_bundles/generate-bank-statement-report-v19.js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const res = await fetch(
  `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/bank-statements/${BUNDLE_PATH}`,
  { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
);
if (!res.ok) {
  throw new Error(`Failed to load function bundle (${res.status}): ${await res.text()}`);
}
const code = await res.text();
Object.assign(globalThis, { __kcwReport: { createClient, ExcelJS } });
(0, eval)(code);
