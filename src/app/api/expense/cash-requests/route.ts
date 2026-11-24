import { NextResponse } from "next/server";

import { requireExpenseCashViewer } from "@/lib/expense/cash-request-api";

export async function GET() {
  const auth = await requireExpenseCashViewer();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  // RLS only allows admin SELECT; use service role after auth for staff view.
  const { data, error } = await auth.admin
    .from("expense_cash_request")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("expense cash list", error);
    return NextResponse.json({ error: "Unable to list requests" }, { status: 500 });
  }

  return NextResponse.json({
    requests: data ?? [],
    canManage: auth.isAdmin,
  });
}
