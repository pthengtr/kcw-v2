import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { enqueueIclowSync } from "@/lib/po/worker-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  try {
    const supabase = createAdminClient();
    const result = await enqueueIclowSync({
      supabase,
      requestedBy: permCheck.userId,
    });

    if (result.alreadyRunning) {
      return NextResponse.json(
        {
          alreadyRunning: true,
          message: "ICLOW sync already running",
          jobs: result.jobs,
        },
        { status: 409 }
      );
    }

    if (!result.workerOnline) {
      return NextResponse.json(
        {
          error: "No ICLOW sync worker is online (HQ-PC or SYP-PC)",
          offlineWorkers: result.offlineWorkers,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      alreadyRunning: false,
      jobs: result.jobs,
    });
  } catch (error) {
    console.error("iclow sync enqueue", error);
    return NextResponse.json(
      { error: "Unable to enqueue ICLOW sync" },
      { status: 500 }
    );
  }
}
