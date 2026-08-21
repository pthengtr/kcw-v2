import { NextResponse } from "next/server";

import { getMyPageAccess } from "@/lib/auth/page-access";

export async function GET() {
  const access = await getMyPageAccess();
  return NextResponse.json(access);
}
