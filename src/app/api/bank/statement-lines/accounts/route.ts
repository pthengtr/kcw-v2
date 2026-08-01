import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import {
  listStatementAccounts,
  type BankAccountOption,
} from "@/lib/bank/statement-accounts";

export type { BankAccountOption };

export async function GET() {
  try {
    const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
    if (!permCheck.ok) {
      return NextResponse.json(
        { error: permCheck.message },
        { status: permCheck.status }
      );
    }

    const supabase = createAdminClient();

    try {
      const { accounts, latestMonth } = await listStatementAccounts(supabase);
      return NextResponse.json({
        accounts,
        latest_month: latestMonth,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: "Query failed",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
