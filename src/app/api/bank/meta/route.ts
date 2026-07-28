import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchBankSyncMeta } from "@/lib/bank/worker-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  try {
    const supabase = createAdminClient();
    const meta = await fetchBankSyncMeta(supabase);
    return NextResponse.json({ meta });
  } catch (error) {
    console.error("bank meta", error);
    return NextResponse.json(
      { error: "Unable to load bank sync meta" },
      { status: 500 }
    );
  }
}
