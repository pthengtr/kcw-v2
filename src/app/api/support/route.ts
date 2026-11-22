import { NextResponse } from "next/server";
import { z } from "zod";

import { ROLE_EXTERNAL } from "@/lib/auth/rbac-pages";
import { getMyPageAccess } from "@/lib/auth/page-access";
import {
  getSupportTarget,
  targetMetaSnapshot,
} from "@/lib/support/catalog";
import { createClient } from "@/lib/supabase/server";

const CreateSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["bug", "improvement", "data_query"]),
  targetSource: z.enum(["kcw-api", "kcw-v2", "hq-data"]),
  targetId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(20000).default(""),
  attachmentPaths: z.array(z.string().min(1)).max(10).default([]),
});

async function requireStaffUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }
  const access = await getMyPageAccess();
  if (access.roleKeys.length === 0) {
    return { ok: false as const, status: 403, message: "No role" };
  }
  if (
    access.roleKeys.includes(ROLE_EXTERNAL) &&
    !access.roleKeys.includes("admin")
  ) {
    return { ok: false as const, status: 403, message: "External users cannot open support" };
  }
  return { ok: true as const, supabase, userId: user.id };
}

export async function GET() {
  const auth = await requireStaffUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("support list", error);
    return NextResponse.json({ error: "Unable to list tickets" }, { status: 500 });
  }

  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireStaffUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const target = getSupportTarget(
    parsed.data.targetSource,
    parsed.data.targetId
  );
  if (!target) {
    return NextResponse.json(
      { error: "Unknown target — pick a catalog service, page, or data domain" },
      { status: 400 }
    );
  }

  const isDataQuery = parsed.data.kind === "data_query";
  if (isDataQuery && target.source !== "hq-data") {
    return NextResponse.json(
      { error: "data_query must use an HQ data target" },
      { status: 400 }
    );
  }
  if (!isDataQuery && target.source === "hq-data") {
    return NextResponse.json(
      { error: "HQ data targets are only for data_query" },
      { status: 400 }
    );
  }

  const row = {
    ...(parsed.data.id ? { id: parsed.data.id } : {}),
    created_by: auth.userId,
    kind: parsed.data.kind,
    target_source: target.source,
    target_id: target.id,
    target_label: target.label,
    target_meta: targetMetaSnapshot(target),
    title: parsed.data.title,
    body: parsed.data.body,
    attachment_paths: parsed.data.attachmentPaths,
    status: "pending" as const,
  };

  const { data: ticket, error } = await auth.supabase
    .from("support_tickets")
    .insert(row)
    .select("*")
    .single();

  if (error || !ticket) {
    console.error("support create", error);
    return NextResponse.json({ error: "Unable to create ticket" }, { status: 500 });
  }

  await auth.supabase.from("support_ticket_events").insert({
    ticket_id: ticket.id,
    event_type: "created",
    actor_id: auth.userId,
    meta: {
      kind: ticket.kind,
      target_source: ticket.target_source,
      target_id: ticket.target_id,
    },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}
