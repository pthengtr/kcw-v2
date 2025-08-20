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
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();

  // 1) Params
  const page = Math.max(1, Number.parseInt(sp.page ?? "1"));
  const pageSize = [10, 20, 50, 100].includes(Number(sp.pageSize))
    ? Number(sp.pageSize)
    : 20;

  const rawQ = (sp.q ?? "").trim();
  const normQ = rawQ.replace(/[%_]/g, " ").trim(); // sanitize wildcards
  const like = `%${normQ}%`;

  const status = (sp.status ?? "ALL") as DocStatus | "ALL";
  const sort = (sp.sort ?? "created_at") as NonNullable<SearchParams["sort"]>;
  const order = (sp.order ?? "desc") as NonNullable<SearchParams["order"]>;
  const dateFrom = (sp.from ?? "").trim();
  const dateTo = (sp.to ?? "").trim();

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;

  // 2) COUNT (head only for speed)
  let countQuery = supabase
    .from("v_dn_list")
    .select("*", { count: "exact", head: true });

  // Text search: ONLY text columns (no enums)
  if (normQ) {
    countQuery = countQuery.or(
      [
        `dn_number.ilike.${like}`,
        `supplier_name.ilike.${like}`,
        `location_code.ilike.${like}`,
        `location_name.ilike.${like}`,
        // If your view exposes status_text (status::text), you can add:
        // `status_text.ilike.${like}`,
      ].join(",")
    );
  }

  // Exact filters
  if (status !== "ALL") countQuery = countQuery.eq("status", status);
  if (dateFrom) countQuery = countQuery.gte("dn_date", dateFrom);
  if (dateTo) countQuery = countQuery.lte("dn_date", dateTo);

  const { count, error: countErr } = await countQuery;
  if (countErr) throw new Error(countErr.message);
  const totalCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  // 3) DATA (paged + ordered)
  let dataQuery = supabase
    .from("v_dn_list")
    .select("*")
    .range(fromIdx, toIdx)
    .order(sort, { ascending: order === "asc", nullsFirst: false });

  if (normQ) {
    dataQuery = dataQuery.or(
      [
        `dn_number.ilike.${like}`,
        `supplier_name.ilike.${like}`,
        `location_code.ilike.${like}`,
        `location_name.ilike.${like}`,
        // If available in your view:
        // `status_text.ilike.${like}`,
      ].join(",")
    );
  }
  if (status !== "ALL") dataQuery = dataQuery.eq("status", status);
  if (dateFrom) dataQuery = dataQuery.gte("dn_date", dateFrom);
  if (dateTo) dataQuery = dataQuery.lte("dn_date", dateTo);

  const { data, error } = await dataQuery;
  if (error) throw new Error(error.message);

  return (
    <div className="py-6 px-12 space-y-4">
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
        q={rawQ}
        status={status}
        sort={sort}
        order={order}
        from={dateFrom || undefined}
        to={dateTo || undefined}
      />
    </div>
  );
}
