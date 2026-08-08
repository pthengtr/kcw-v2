import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchExpenseOverview } from "./expense-queries";
import {
  deriveIncomeStatement,
  INCOME_STATEMENT_BRANCH_UUID,
} from "./income-statement";
import type { BiIncomeStatementOverview } from "./income-statement-types";
import { fetchVatOverview } from "./vat-queries";

function expenseBranchUuid(
  branch: string | null | undefined
): string | null {
  if (branch === "HQ") return INCOME_STATEMENT_BRANCH_UUID.HQ;
  if (branch === "SYP") return INCOME_STATEMENT_BRANCH_UUID.SYP;
  return null;
}

export async function fetchIncomeStatementOverview(
  supabase: SupabaseClient,
  params: { from: string; to: string; branch?: string | null }
): Promise<BiIncomeStatementOverview> {
  const branch = params.branch ?? null;
  const [vat, companyExpense] = await Promise.all([
    fetchVatOverview(supabase, {
      from: params.from,
      to: params.to,
      branch,
    }),
    fetchExpenseOverview(supabase, {
      from: params.from,
      to: params.to,
      branch: expenseBranchUuid(branch),
      source: "ENTRIES",
      limit: 5,
    }),
  ]);

  return deriveIncomeStatement({ vat, companyExpense });
}
