import { NextResponse } from "next/server";
import { z } from "zod";

import {
  callExpenseCashApi,
  requireExpenseCashAdmin,
} from "@/lib/expense/cash-request-api";

const ActionSchema = z.object({
  action: z.enum(["approve", "needs_info", "reject", "cancel", "refresh"]),
  note: z.string().trim().max(2000).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

function upstreamError(json: unknown, fallback: string) {
  const detail = (json as { detail?: { message?: string } | string })?.detail;
  if (detail && typeof detail === "object" && detail.message) {
    return detail.message;
  }
  if (typeof detail === "string") return detail;
  return fallback;
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireExpenseCashAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const { id } = await ctx.params;

  try {
    const res = await callExpenseCashApi(`/expense-cash/requests/${id}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Fallback to Supabase read if Railway refresh unavailable.
      const { data, error } = await auth.supabase
        .from("expense_cash_request")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json(
          { error: upstreamError(json, "Unable to load request") },
          { status: res.status }
        );
      }
      return NextResponse.json({ request: data, voucher: null });
    }
    return NextResponse.json(json);
  } catch (err) {
    const { data, error } = await auth.supabase
      .from("expense_cash_request")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      console.error("expense cash get", err, error);
      return NextResponse.json({ error: "Unable to load request" }, { status: 502 });
    }
    return NextResponse.json({ request: data, voucher: null });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireExpenseCashAdmin();
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

  const { action, note } = parsed.data;
  if ((action === "needs_info" || action === "reject") && !(note || "").trim()) {
    return NextResponse.json({ error: "note required" }, { status: 400 });
  }

  if (action === "refresh") {
    try {
      const res = await callExpenseCashApi(`/expense-cash/requests/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: upstreamError(json, "Upstream error"), upstream: json },
          { status: res.status }
        );
      }
      return NextResponse.json(json);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to refresh voucher",
        },
        { status: 502 }
      );
    }
  }

  const path =
    action === "approve"
      ? `/expense-cash/requests/${id}/approve`
      : action === "needs_info"
        ? `/expense-cash/requests/${id}/needs-info`
        : action === "reject"
          ? `/expense-cash/requests/${id}/reject`
          : `/expense-cash/requests/${id}/cancel`;

  try {
    const res = await callExpenseCashApi(path, {
      method: "POST",
      body: JSON.stringify({
        note: note || null,
        reviewer_name: auth.userEmail,
        reviewer_id: auth.userId,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          error: upstreamError(json, "Upstream error"),
          upstream: json,
        },
        { status: res.status }
      );
    }
    return NextResponse.json(json);
  } catch (err) {
    console.error("expense cash action", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to call expense-cash API",
      },
      { status: 502 }
    );
  }
}
