import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import {
  BANK_PAGE_KEYS,
  ONLINE_STATEMENT_READ_PAGE_KEYS,
} from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";

type JobRow = {
  id: number;
  status: string;
  worker_name: string | null;
  result_message: string | null;
  error_message: string | null;
  requested_at: string | null;
  finished_at: string | null;
};

async function latestJob() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("fn_online_statement_latest_job");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as JobRow | undefined;
  return row ?? null;
}

export async function GET() {
  const permCheck = await requirePermission(ONLINE_STATEMENT_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  try {
    const job = await latestJob();
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.onlineStatements);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  try {
    const current = await latestJob();
    if (current && (current.status === "pending" || current.status === "running")) {
      return NextResponse.json({ alreadyRunning: true, job: current });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("fn_online_statement_enqueue", {
      p_requested_by: permCheck.userEmail,
    });
    if (error) throw error;
    const job = (Array.isArray(data) ? data[0] : data) as JobRow | undefined;
    return NextResponse.json({ alreadyRunning: false, job: job ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to enqueue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
