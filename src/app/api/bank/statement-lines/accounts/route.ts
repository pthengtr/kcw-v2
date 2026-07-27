import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";

export type BankAccountOption = {
  account_no: string;
  bank_name: string | null;
};

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

    const { data, error } = await supabase
      .schema("bank")
      .from("statement_lines")
      .select("account_no, bank_name")
      .order("account_no", { ascending: true })
      .limit(5000);

    if (error) {
      return NextResponse.json(
        { error: "Query failed", details: error.message },
        { status: 500 }
      );
    }

    const seen = new Set<string>();
    const accounts: BankAccountOption[] = [];

    for (const row of data ?? []) {
      const accountNo = row.account_no?.trim();
      if (!accountNo || seen.has(accountNo)) continue;
      seen.add(accountNo);
      accounts.push({
        account_no: accountNo,
        bank_name: row.bank_name ?? null,
      });
    }

    return NextResponse.json({ accounts });
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
