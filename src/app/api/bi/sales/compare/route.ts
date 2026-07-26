import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { fetchSalesCompare, normalizePeriods, normalizeYears } from "@/lib/bi/sales-compare";
import { createAdminClient } from "@/lib/supabase/admin";

const QuerySchema = z.object({
  mode: z.enum(["years", "months"]).default("years"),
  years: z.string().optional(),
  periods: z.string().optional(),
  branch: z.enum(["HQ", "SYP", "ONLINE"]).optional(),
});

function parseYearList(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n));
}

function parsePeriodList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json(
      { error: adminCheck.message },
      { status: adminCheck.status }
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    mode: url.searchParams.get("mode") || "years",
    years: url.searchParams.get("years") || undefined,
    periods: url.searchParams.get("periods") || undefined,
    branch: url.searchParams.get("branch") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const years = normalizeYears(parseYearList(parsed.data.years));
  const periods = normalizePeriods(parsePeriodList(parsed.data.periods));

  if (parsed.data.mode === "years" && years.length === 0) {
    return NextResponse.json(
      { error: "Select at least one year" },
      { status: 400 }
    );
  }

  if (parsed.data.mode === "months" && periods.length === 0) {
    return NextResponse.json(
      { error: "Select at least one month" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    const compare = await fetchSalesCompare(supabase, {
      mode: parsed.data.mode,
      years,
      periods,
      branch: parsed.data.branch ?? null,
    });
    return NextResponse.json({ compare });
  } catch (error) {
    console.error("bi sales compare", error);
    return NextResponse.json(
      { error: "Unable to load sales comparison" },
      { status: 500 }
    );
  }
}
