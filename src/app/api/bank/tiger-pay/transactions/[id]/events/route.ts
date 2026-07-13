import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTigerPayWebhookEvents } from "@/lib/bank/tiger-pay-queries";
import { redactSensitive } from "@/lib/bank/tiger-pay-format";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json(
      { error: adminCheck.message },
      { status: adminCheck.status }
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
