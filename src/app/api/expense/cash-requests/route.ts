import { NextResponse } from "next/server";

import { requireExpenseCashAdmin } from "@/lib/expense/cash-request-api";

export async function GET() {
  const auth = await requireExpenseCashAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from("expense_cash_request")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("expense cash list", error);
    return NextResponse.json({ error: "Unable to list requests" }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}
