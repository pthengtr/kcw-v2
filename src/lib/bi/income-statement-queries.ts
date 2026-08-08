import type { SupabaseClient } from "@supabase/supabase-js";

import { deriveIncomeStatementFromVat } from "./income-statement";
import type { BiIncomeStatementOverview } from "./income-statement-types";
import { fetchVatOverview } from "./vat-queries";

export async function fetchIncomeStatementOverview(
  supabase: SupabaseClient,
  params: { from: string; to: string; branch?: string | null }
): Promise<BiIncomeStatementOverview> {
  const vat = await fetchVatOverview(supabase, params);
  return deriveIncomeStatementFromVat(vat);
}
