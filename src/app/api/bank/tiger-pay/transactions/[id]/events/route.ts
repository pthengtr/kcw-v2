import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTigerPayWebhookEvents } from "@/lib/bank/tiger-pay-queries";
import { redactSensitive } from "@/lib/bank/tiger-pay-format";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.tigerPay);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { id } = await params;
  const tigerPaymentId = Number(id);
  if (!Number.isFinite(tigerPaymentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const events = await getTigerPayWebhookEvents(supabase, tigerPaymentId);

    return NextResponse.json({
      rows: events.map((event) => ({
        ...event,
        payload: redactSensitive(event.payload),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load Tiger Pay event history" },
      { status: 500 }
    );
  }
}
