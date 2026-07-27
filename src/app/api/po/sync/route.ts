import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { enqueuePoSync } from "@/lib/po/worker-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  site: z.enum(["HQ", "SYP"]),
});

export async function POST(req: Request) {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const result = await enqueuePoSync({
      supabase,
      site: parsed.data.site,
      requestedBy: permCheck.userId,
    });

    if (result.alreadyRunning) {
      return NextResponse.json(
        {
          alreadyRunning: true,
          message: "PO sync already running",
          job: result.job,
        },
        { status: 409 }
      );
    }

    if (!result.workerOnline) {
      return NextResponse.json(
        {
          error: `Worker ${result.workerName} is offline`,
          workerName: result.workerName,
          lastSeen: result.lastSeen,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      alreadyRunning: false,
      job: result.job,
    });
  } catch (error) {
    console.error("po sync enqueue", error);
    return NextResponse.json(
      { error: "Unable to enqueue PO sync" },
      { status: 500 }
    );
  }
}
