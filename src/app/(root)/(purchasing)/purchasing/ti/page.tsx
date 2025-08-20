import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import TIListTableSSR, {
  type VTiListRow,
  type DocStatus,
} from "@/components/purchasing/TIListTableSSR";

type SearchParams = {
  page?: string;
  pageSize?: string;
  q?: string;
  status?: DocStatus | "ALL";
  sort?:
    | "created_at"
    | "ti_date"
    | "ti_number"
    | "supplier_name"
    | "location_code"
    | "status"
    | "line_count"
    | "grand_total";
  order?: "asc" | "desc";
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
};

export default async function TIListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, Number.parseInt(sp.page ?? "1"));
  const pageSize = [10, 20, 50, 100].includes(Number(sp.pageSize))
    ? Number(sp.pageSize)
    : 20;

  const rawQ = (sp.q ?? "").trim();
  const normQ = rawQ.replace(/[%_]/g, " ").trim();
  const like = `%${normQ}%`;

  const status = (sp.status ?? "ALL") as DocStatus | "ALL";
  const sort = (sp.sort ?? "created_at") as NonNullable<SearchParams["sort"]>;
  const order = (sp.order ?? "desc") as NonNullable<SearchParams["order"]>;
  const dateFrom = (sp.from ?? "").trim();
  const dateTo = (sp.to ?? "").trim();

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  // COUNT
  let countQuery = supabase
    .from("v_ti_list")
    .select("*", { count: "exact", head: true });

  if (normQ) {
    countQuery = countQuery.or(
      [
        `ti_number.ilike.${like}`,
        `supplier_name.ilike.${like}`,
        `location_code.ilike.${like}`,
        `status_text.ilike.${like}`, // text version of enum
      ].join(",")
    );
  }
  if (status !== "ALL") countQuery = countQuery.eq("status", status);
  if (dateFrom) countQuery = countQuery.gte("ti_date", dateFrom);
  if (dateTo) countQuery = countQuery.lte("ti_date", dateTo);

  const { count, error: countErr } = await countQuery;
  if (countErr) throw new Error(countErr.message);

  const totalCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  // DATA
  let dataQuery = supabase
    .from("v_ti_list")
    .select("*")
    .range(fromIdx, toIdx)
    .order(sort, { ascending: order === "asc", nullsFirst: false });

  if (normQ) {
    dataQuery = dataQuery.or(
      [
        `ti_number.ilike.${like}`,
        `supplier_name.ilike.${like}`,
        `location_code.ilike.${like}`,
        `status_text.ilike.${like}`,
      ].join(",")
    );
  }
  if (status !== "ALL") dataQuery = dataQuery.eq("status", status);
  if (dateFrom) dataQuery = dataQuery.gte("ti_date", dateFrom);
  if (dateTo) dataQuery = dataQuery.lte("ti_date", dateTo);

  const { data, error } = await dataQuery;
  if (error) throw new Error(error.message);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tax Invoices (TI)</h1>
        <Link href="/purchasing/ti/new">
          <Button>New TI</Button>
        </Link>
      </div>

      <TIListTableSSR
        rows={(data ?? []) as VTiListRow[]}
        page={page}
        pageCount={pageCount}
        totalCount={totalCount}
        q={rawQ}
        from={dateFrom || undefined}
        to={dateTo || undefined}
      />
    </div>
  );
}
