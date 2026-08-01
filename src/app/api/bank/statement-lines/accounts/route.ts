import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import {
  listStatementAccounts,
  type BankAccountOption,
} from "@/lib/bank/statement-accounts";

export type { BankAccountOption };

const QuerySchema = z.object({
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  try {
    const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
    if (!permCheck.ok) {
      return NextResponse.json(
        { error: permCheck.message },
        { status: permCheck.status }
      );
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { from, to } = parsed.data;
    if (from > to) {
      return NextResponse.json(
        { error: "`from` must be on or before `to`" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    try {
      const accounts = await listStatementAccounts(supabase, { from, to });
      return NextResponse.json({ accounts, from, to });
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
