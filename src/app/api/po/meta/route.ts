import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/requirePermission";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { fetchPoMeta } from "@/lib/po/po-queries";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const permCheck = await requirePermission(PO_PAGE_KEYS.status);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  try {
    const supabase = createAdminClient();
    const { sites, inventory, iclow, poRelated } = await fetchPoMeta(supabase);
    return NextResponse.json({ meta: sites, inventory, iclow, poRelated });
  } catch (error) {
    console.error("po meta", error);
    return NextResponse.json(
      { error: "Unable to load PO meta" },
      { status: 500 }
    );
  }
}
