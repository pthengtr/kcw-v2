import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addIsoDays,
  rollupTigerPayDay,
} from "@/lib/bank/tiger-pay-daily";
import {
  getDailyClose,
  getLatestCashSnapshot,
  getTigerPayAttemptsForWindow,
  getTigerPayTransactionsForWindow,
  getTigerPayVouchersForWindow,
} from "@/lib/bank/tiger-pay-queries";

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shop: z.string().trim().min(1).max(32).default("1"),
});

function windowIso(date: string) {
  const from = `${addIsoDays(date, -1)}T00:00:00+07:00`;
  const to = `${addIsoDays(date, 2)}T00:00:00+07:00`;
  return { from, to };
}

export async function GET(req: Request) {
  const permCheck = await requirePermission(BANK_PAGE_KEYS.tigerPay);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined,
    shop: url.searchParams.get("shop") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { date, shop } = parsed.data;
  const { from, to } = windowIso(date);
  const prevDate = addIsoDays(date, -1);

  try {
    const supabase = createAdminClient();
    const [transactions, attempts, vouchers, hopper, dailyClose] =
      await Promise.all([
        getTigerPayTransactionsForWindow(supabase, {
          fromIso: from,
          toIso: to,
          shopCode: shop,
        }),
        getTigerPayAttemptsForWindow(supabase, { fromIso: from, toIso: to }).catch(
          (error) => {
            console.error("tiger-pay daily attempts", error);
            return [];
          }
        ),
        getTigerPayVouchersForWindow(supabase, { fromIso: from, toIso: to }).catch(
          (error) => {
            console.error("tiger-pay daily vouchers", error);
            return [];
          }
        ),
        getLatestCashSnapshot(supabase, shop).catch((error) => {
          console.error("tiger-pay daily hopper", error);
          return null;
        }),
        getDailyClose(supabase, { date, shopCode: shop }).catch((error) => {
          console.error("tiger-pay daily close", error);
          return null;
        }),
      ]);

    const today = rollupTigerPayDay({
      date,
      shopCode: shop,
      transactions,
      attempts,
      vouchers,
    });
    const previous = rollupTigerPayDay({
      date: prevDate,
      shopCode: shop,
      transactions,
      attempts,
      vouchers,
    });

    return NextResponse.json({
      date,
      shop,
      today,
      previous,
      hopper,
      dailyClose,
    });
  } catch (error) {
    console.error("tiger-pay daily", error);
    return NextResponse.json(
      { error: "Unable to load Tiger Pay daily status" },
      { status: 500 }
    );
  }
}
