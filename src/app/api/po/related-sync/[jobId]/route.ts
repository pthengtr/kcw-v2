import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { getJobById } from "@/lib/po/worker-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { jobId: rawId } = await params;
  const jobId = Number(rawId);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const job = await getJobById(supabase, jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (error) {
    console.error("po related sync poll", error);
    return NextResponse.json(
      { error: "Unable to load job status" },
      { status: 500 }
    );
  }
}
