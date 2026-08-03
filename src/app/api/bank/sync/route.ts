import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { enqueueBankImport } from "@/lib/bank/worker-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.statementSync);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  try {
    const supabase = createAdminClient();
    const result = await enqueueBankImport({
      supabase,
      requestedBy: permCheck.userId,
    });

    if (result.alreadyRunning) {
      return NextResponse.json(
        {
          alreadyRunning: true,
          message: "Bank statement sync already running",
          job: result.job,
        },
        { status: 409 }
      );
    }

    if (!result.workerOnline) {
      return NextResponse.json(
        {
          error: "No bank sync worker is online (HQ-PC)",
          workers: result.workers,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      alreadyRunning: false,
      job: result.job,
    });
  } catch (error) {
    console.error("bank sync enqueue", error);
    return NextResponse.json(
      { error: "Unable to enqueue bank statement sync" },
      { status: 500 }
    );
  }
}
