import { NextResponse } from "next/server";
import { z } from "zod";

import { ROLE_EXTERNAL } from "@/lib/auth/rbac-pages";
import { getMyPageAccess } from "@/lib/auth/page-access";
import { createClient } from "@/lib/supabase/server";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("close"),
    comment: z.string().trim().max(5000).optional(),
  }),
  z.object({
    action: z.literal("reopen"),
    comment: z.string().trim().min(1).max(5000),
  }),
  z.object({
    action: z.literal("setAttachments"),
    attachmentPaths: z.array(z.string().min(1)).max(10),
  }),
]);

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
    return {
      ok: false as const,
      status: 403,
      message: "External users cannot open support",
    };
  }
  return { ok: true as const, supabase, userId: user.id };
}

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await requireStaffUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await ctx.params;
  const { data: ticket, error } = await auth.supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("support get", error);
    return NextResponse.json({ error: "Unable to load ticket" }, { status: 500 });
  }
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: events } = await auth.supabase
    .from("support_ticket_events")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ ticket, events: events ?? [] });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await requireStaffUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: ticket, error: loadError } = await auth.supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.action === "setAttachments") {
    if (!["pending", "failed"].includes(ticket.status)) {
      return NextResponse.json(
        { error: "Attachments can only be set before the agent starts" },
        { status: 409 }
      );
    }
    const { data: updated, error } = await auth.supabase
      .from("support_tickets")
      .update({ attachment_paths: parsed.data.attachmentPaths })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !updated) {
      return NextResponse.json({ error: "Unable to update attachments" }, { status: 500 });
    }
    return NextResponse.json({ ticket: updated });
  }

  if (parsed.data.action === "close") {
    if (!["waiting", "failed"].includes(ticket.status)) {
      return NextResponse.json(
        { error: "Ticket can only be closed when waiting or failed" },
        { status: 409 }
      );
    }
    const { data: updated, error } = await auth.supabase
      .from("support_tickets")
      .update({
        status: "done",
        finished_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !updated) {
      return NextResponse.json({ error: "Unable to close ticket" }, { status: 500 });
    }
    await auth.supabase.from("support_ticket_events").insert({
      ticket_id: id,
      event_type: "closed",
      actor_id: auth.userId,
      comment: parsed.data.comment ?? null,
    });
    return NextResponse.json({ ticket: updated });
  }

  // reopen
  if (!["waiting", "failed", "done"].includes(ticket.status)) {
    return NextResponse.json(
      { error: "Ticket cannot be reopened in its current status" },
      { status: 409 }
    );
  }

  const { data: updated, error } = await auth.supabase
    .from("support_tickets")
    .update({
      status: "pending",
      reopen_count: (ticket.reopen_count ?? 0) + 1,
      claimed_at: null,
      finished_at: null,
      error_message: null,
      agent_session_id: null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Unable to reopen ticket" }, { status: 500 });
  }

  await auth.supabase.from("support_ticket_events").insert({
    ticket_id: id,
    event_type: "reopened",
    actor_id: auth.userId,
    comment: parsed.data.comment,
    meta: {
      prior_pr_url: ticket.pr_url,
      prior_status: ticket.status,
    },
  });

  return NextResponse.json({ ticket: updated });
}
