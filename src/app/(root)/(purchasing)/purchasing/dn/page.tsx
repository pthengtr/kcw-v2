import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DNListTableSSR, {
  type VDnListRow,
  type DocStatus,
} from "@/components/purchasing/DNListTableSSR";
import { Button } from "@/components/ui/button";

type SearchParams = {
  page?: string;
  pageSize?: string;
  q?: string;
  status?: DocStatus | "ALL";
  sort?:
    | "created_at"
    | "dn_date"
    | "dn_number"
    | "supplier_name"
    | "location_code"
    | "status"
    | "line_count";
  order?: "asc" | "desc";
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
};

export default async function DNListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>; // <-- Promise!
}) {
  const sp = await searchParams; // <-- await it

  const supabase = await createClient();

  // 1) Params
  const page = Math.max(1, Number.parseInt(sp.page ?? "1"));
  const pageSize = [10, 20, 50, 100].includes(Number(sp.pageSize))
    ? Number(sp.pageSize)
    : 20;

  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "ALL") as DocStatus | "ALL";
  const sort = (sp.sort ?? "created_at") as NonNullable<SearchParams["sort"]>;
  const order = (sp.order ?? "desc") as NonNullable<SearchParams["order"]>;
  const dateFrom = (sp.from ?? "").trim();
  const dateTo = (sp.to ?? "").trim();
  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  // 2) COUNT query (head-only for speed)
  let countQuery = supabase
    .from("v_dn_list")
    .select("*", { count: "exact", head: true });

  if (q) {
    countQuery = countQuery.or(
      [
        `dn_number.ilike.%${q}%`,
        `supplier_name.ilike.%${q}%`,
        `location_code.ilike.%${q}%`,
        `location_name.ilike.%${q}%`,
        `status.ilike.%${q}%`,
      ].join(",")
    );
  }
  if (status !== "ALL") countQuery = countQuery.eq("status", status);
  if (dateFrom) countQuery = countQuery.gte("dn_date", dateFrom);
  if (dateTo) countQuery = countQuery.lte("dn_date", dateTo);

  const { count, error: countErr } = await countQuery;
  if (countErr) throw new Error(countErr.message);
  const totalCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  // 3) DATA query (paged + ordered)
  let dataQuery = supabase
    .from("v_dn_list")
    .select("*")
    .range(fromIdx, toIdx)
    .order(sort, { ascending: order === "asc", nullsFirst: false });

  if (q) {
    dataQuery = dataQuery.or(
      [
        `dn_number.ilike.%${q}%`,
        `supplier_name.ilike.%${q}%`,
        `location_code.ilike.%${q}%`,
        `location_name.ilike.%${q}%`,
        `status.ilike.%${q}%`,
      ].join(",")
    );
  }
  if (status !== "ALL") dataQuery = dataQuery.eq("status", status);
  if (dateFrom) dataQuery = dataQuery.gte("dn_date", dateFrom);
  if (dateTo) dataQuery = dataQuery.lte("dn_date", dateTo);

  const { data, error } = await dataQuery;
  if (error) throw new Error(error.message);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Goods Received (DN)</h1>
        <Link href="/purchasing/dn/new">
          <Button>New DN</Button>
        </Link>
      </div>

      <DNListTableSSR
        rows={(data ?? []) as VDnListRow[]}
        page={page}
        pageSize={pageSize}
        pageCount={pageCount}
        totalCount={totalCount}
        q={q}
        status={status}
        sort={sort}
        order={order}
        from={dateFrom || undefined}
        to={dateTo || undefined}
      />
    </div>
  );
}
