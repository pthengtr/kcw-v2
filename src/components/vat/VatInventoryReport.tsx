import Link from "next/link";
import { ChevronLeft, FileSpreadsheet, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  VatInventorySiteSwitch,
  VatInventoryYearSwitch,
} from "@/components/vat/VatInventorySiteSwitch";
import {
  VAT_INVENTORY_PAGE_SIZE,
  VAT_MOVEMENT_KIND_LABEL,
  deductQty,
  type VatInventoryDetail,
  type VatInventoryList,
  type VatInventorySummary,
  type VatSite,
} from "@/lib/vat/inventory";
import { cn } from "@/lib/utils";

const KIND_TONE: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-700",
  PI: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  RV: "bg-sky-50 text-sky-800 ring-sky-100",
  SALE: "bg-rose-50 text-rose-800 ring-rose-100",
  TAR: "bg-amber-50 text-amber-900 ring-amber-100",
  SA: "bg-violet-50 text-violet-800 ring-violet-100",
  TF: "bg-indigo-50 text-indigo-800 ring-indigo-100",
};

function exportHref(search: string, site: VatSite, year: number, bcode?: string): string {
  const params = new URLSearchParams();
  params.set("site", site);
  params.set("year", String(year));
  if (bcode) params.set("bcode", bcode);
  else if (search) params.set("q", search);
  return `/api/vat-inventory/export?${params.toString()}`;
}

function qty(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value);
}

function baht(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function thaiDate(value: string | null | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${Number(day)}/${Number(month)}/${Number(year) + 543}`;
}

function blankNumber(value: number | null | undefined): boolean {
  return value == null || Number.isNaN(value) || Math.abs(value) < 1e-9;
}

function amountClass(
  value: number | null | undefined,
  tone: "plain" | "signed" | "emphasis" = "plain"
): string {
  const blank = blankNumber(value);
  return cn(
    "whitespace-nowrap px-3 py-2 text-right tabular-nums",
    tone === "emphasis" && "bg-emerald-50/80",
    blank && "text-slate-300",
    !blank && tone === "emphasis" && "font-semibold text-emerald-950",
    !blank && tone === "signed" && (value ?? 0) < 0 && "font-medium text-rose-700",
    !blank && tone === "signed" && (value ?? 0) > 0 && "font-medium text-emerald-700",
    !blank && tone === "plain" && "text-slate-700"
  );
}

const headCell =
  "sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-500";

export function VatInventoryListView({
  basePath,
  summary,
  list,
  search,
  offset,
  site,
  year,
  years,
  showActual = true,
}: {
  basePath: string;
  summary: VatInventorySummary;
  list: VatInventoryList;
  search: string;
  offset: number;
  site: VatSite;
  year: number;
  years: number[];
  /** PARTS9 on-hand. Internal report only. */
  showActual?: boolean;
}) {
  const page = Math.floor(offset / VAT_INVENTORY_PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(list.total / VAT_INVENTORY_PAGE_SIZE));
  const query = (nextOffset: number) => {
    const params = new URLSearchParams();
    params.set("site", site);
    params.set("year", String(year));
    if (search) params.set("q", search);
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    const text = params.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  const hasPrev = offset > 0;
  const hasNext = offset + VAT_INVENTORY_PAGE_SIZE < list.total;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            รายงานสินค้าคงเหลือ
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            คงเหลือ = ยกมา + ซื้อ VAT + RV + ขาย VAT + TAR + ปรับสต็อก + โอน.
            ขาย VAT, TAR และการปรับที่หักสต็อกแสดงเป็นจำนวนติดลบ
          </p>
        </div>
        {summary.rebuilt_at ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            คำนวณเมื่อ {thaiDate(summary.rebuilt_at)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="มูลค่าคงเหลือ" value={baht(summary.value)} accent />
        <Metric label="จำนวนคงเหลือ" value={qty(summary.qty)} />
        <Metric label="รหัสสินค้า" value={qty(summary.products)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <VatInventoryYearSwitch
          basePath={basePath}
          search={search}
          site={site}
          year={year}
          years={years}
        />
        <VatInventorySiteSwitch basePath={basePath} search={search} site={site} year={year} />
        <form className="flex flex-1 items-center gap-2" action={basePath}>
          <input type="hidden" name="site" value={site} />
          <input type="hidden" name="year" value={year} />
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              name="q"
              defaultValue={search}
              placeholder="รหัสหรือชื่อสินค้า"
              className="bg-white pl-8"
            />
          </div>
          <Button type="submit">ค้นหา</Button>
        </form>
        <Button variant="outline" asChild>
          <a href={exportHref(search, site, year)}>
            <FileSpreadsheet />
            ส่งออก Excel
          </a>
        </Button>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left">
              <th className={cn(headCell, "left-0 z-20 min-w-28")}>รหัส</th>
              <th className={headCell}>ชื่อ</th>
              <th className={cn(headCell, "text-right")}>ยกมา</th>
              <th className={cn(headCell, "text-right")}>ซื้อ VAT</th>
              <th className={cn(headCell, "text-right")}>RV</th>
              <th className={cn(headCell, "text-right")}>ขาย VAT</th>
              <th className={cn(headCell, "text-right")}>TAR</th>
              <th className={cn(headCell, "text-right")}>ปรับสต็อก</th>
              <th className={cn(headCell, "text-right")}>โอน</th>
              <th className={cn(headCell, "bg-emerald-50 text-right text-emerald-900")}>
                คงเหลือ
              </th>
              <th className={cn(headCell, "bg-emerald-50 text-right text-emerald-900")}>
                มูลค่า
              </th>
              {showActual ? (
                <th className={cn(headCell, "text-right")}>คงเหลือจริง</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {list.rows.map((row) => (
              <tr key={row.bcode} className="group hover:bg-slate-50/80">
                <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2 font-medium group-hover:bg-slate-50">
                  <Link
                    href={`${basePath}/${encodeURIComponent(row.bcode)}?site=${site}&year=${year}`}
                    className="font-mono text-[13px] text-sky-800 hover:underline"
                  >
                    {row.bcode}
                  </Link>
                </td>
                <td className="max-w-xs truncate border-b border-slate-100 px-3 py-2 text-slate-800">
                  {row.descr}
                </td>
                <td className={cn(amountClass(row.open_qty), "border-b border-slate-100")}>
                  {qty(row.open_qty)}
                </td>
                <td className={cn(amountClass(row.purchase_qty), "border-b border-slate-100")}>
                  {qty(row.purchase_qty)}
                </td>
                <td className={cn(amountClass(row.rv_qty), "border-b border-slate-100")}>
                  {qty(row.rv_qty)}
                </td>
                <td className={cn(amountClass(deductQty(row.sale_qty), "signed"), "border-b border-slate-100")}>
                  {qty(deductQty(row.sale_qty))}
                </td>
                <td className={cn(amountClass(deductQty(row.tar_qty), "signed"), "border-b border-slate-100")}>
                  {qty(deductQty(row.tar_qty))}
                </td>
                <td className={cn(amountClass(deductQty(row.sa_qty), "signed"), "border-b border-slate-100")}>
                  {qty(deductQty(row.sa_qty))}
                </td>
                <td className={cn(amountClass(row.tf_qty, "signed"), "border-b border-slate-100")}>
                  {qty(row.tf_qty)}
                </td>
                <td className={cn(amountClass(row.qty, "emphasis"), "border-b border-emerald-100")}>
                  {qty(row.qty)}
                </td>
                <td className={cn(amountClass(row.value, "emphasis"), "border-b border-emerald-100")}>
                  {baht(row.value)}
                </td>
                {showActual ? (
                  <td
                    className={cn(
                      amountClass(row.actual_qty),
                      "border-b border-slate-100 text-slate-500"
                    )}
                  >
                    {qty(row.actual_qty)}
                  </td>
                ) : null}
              </tr>
            ))}
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={showActual ? 12 : 11} className="px-3 py-16 text-center text-sm text-slate-500">
                  ยังไม่มีรายการ
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {qty(list.total)} รายการ · หน้า {page}/{pages}
        </span>
        <span className="flex gap-2">
          {hasPrev ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={query(Math.max(0, offset - VAT_INVENTORY_PAGE_SIZE))}>ก่อนหน้า</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              ก่อนหน้า
            </Button>
          )}
          {hasNext ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={query(offset + VAT_INVENTORY_PAGE_SIZE)}>ถัดไป</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              ถัดไป
            </Button>
          )}
        </span>
      </div>
    </main>
  );
}

export function VatInventoryDrillView({
  basePath,
  detail,
  site,
  year,
  showActual = true,
}: {
  basePath: string;
  detail: VatInventoryDetail;
  site: VatSite;
  year: number;
  /** PARTS9 on-hand. Internal report only. */
  showActual?: boolean;
}) {
  const product = detail.product;
  if (!product) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-slate-600">ไม่พบรหัสสินค้านี้ในรายงานสินค้าคงเหลือ</p>
        <Button variant="link" className="mt-2 px-0" asChild>
          <Link href={`${basePath}?site=${site}&year=${year}`}>กลับไปหน้ารายการ</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <Link
          href={`${basePath}?site=${site}&year=${year}`}
          className="inline-flex items-center gap-1 text-sm text-sky-800 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          กลับไปหน้ารายการ
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div>
            <div className="font-mono text-sm text-sky-800">
              {product.bcode}
              <span className="ml-2 text-xs font-medium tracking-wide text-slate-500">
                {site === "all" ? "ทั้งหมด" : site.toUpperCase()} · {year + 543}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {product.descr || product.bcode}
            </h1>
          </div>
          <Button variant="outline" asChild>
            <a href={exportHref("", site, year, product.bcode)}>
              <FileSpreadsheet />
              ส่งออก Excel
            </a>
          </Button>
        </div>
        <div className={cn("mt-3 grid gap-3", showActual ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <Metric label="คงเหลือ" value={qty(product.qty)} accent />
          <Metric label="มูลค่า" value={baht(product.value)} />
          {showActual ? <Metric label="คงเหลือจริง" value={qty(product.actual_qty)} /> : null}
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-slate-900">ที่มาของของคงเหลือ</h2>
        <div className="max-h-[40vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                <th className={headCell}>วันที่</th>
                <th className={headCell}>เอกสาร</th>
                <th className={headCell}>แหล่ง</th>
                <th className={headCell}>ผู้ขาย</th>
                <th className={cn(headCell, "text-right")}>จำนวนคงเหลือ</th>
                <th className={cn(headCell, "text-right")}>ทุน/หน่วย</th>
                <th className={cn(headCell, "bg-emerald-50 text-right text-emerald-900")}>
                  มูลค่า
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.layers.map((layer) => (
                <tr
                  key={`${layer.billno}-${layer.billdate}-${layer.qty}`}
                  className="hover:bg-slate-50/80"
                >
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-700">
                    {thaiDate(layer.billdate)}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 font-mono text-[13px]">
                    {layer.billno}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <KindPill kind={layer.source === "RV" ? "RV" : "PI"} />
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {layer.supplier}
                  </td>
                  <td className={cn(amountClass(layer.qty), "border-b border-slate-100")}>
                    {qty(layer.qty)}
                  </td>
                  <td className={cn(amountClass(layer.unit_cost), "border-b border-slate-100")}>
                    {baht(layer.unit_cost)}
                  </td>
                  <td
                    className={cn(
                      amountClass(layer.qty * layer.unit_cost, "emphasis"),
                      "border-b border-emerald-100"
                    )}
                  >
                    {baht(layer.qty * layer.unit_cost)}
                  </td>
                </tr>
              ))}
              {detail.layers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-sm text-slate-500">
                    ไม่มีของคงเหลือที่จับทุนได้
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">ความเคลื่อนไหวปี 2026</h2>
          <p className="mt-1 text-sm text-slate-500">
            ทุนซื้อของบิลขายไล่ FIFO จากบิลซื้อที่เก่ากว่า หลังกันของใหม่ไว้เป็นสต็อก
            ราคาเป็นต่อหน่วยเล็กสุด ไม่รวม VAT
          </p>
        </div>
        <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left">
                <th className={headCell}>วันที่</th>
                <th className={headCell}>เอกสาร</th>
                <th className={headCell}>ประเภท</th>
                <th className={headCell}>สาขา</th>
                <th className={cn(headCell, "text-right")}>จำนวน</th>
                <th className={cn(headCell, "text-right")}>ทุนซื้อ</th>
                <th className={headCell}>บิลซื้อ</th>
                <th className={cn(headCell, "text-right")}>ราคาขาย</th>
                <th className={cn(headCell, "bg-emerald-50 text-right text-emerald-900")}>
                  คงเหลือ
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.movements.map((row, index) => (
                <tr
                  key={`${row.billdate}-${row.billno}-${index}`}
                  className="hover:bg-slate-50/80"
                >
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-700">
                    {thaiDate(row.billdate)}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 font-mono text-[13px]">
                    {row.billno || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2">
                    <KindPill kind={row.kind} />
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-xs font-medium tracking-wide text-slate-500">
                    {row.site ? row.site.toUpperCase() : "—"}
                  </td>
                  <td className={cn(amountClass(row.qty, "signed"), "border-b border-slate-100")}>
                    {qty(row.qty)}
                  </td>
                  <td className={cn(amountClass(row.unit_cost), "border-b border-slate-100")}>
                    {baht(row.unit_cost)}
                  </td>
                  <td className="max-w-xs border-b border-slate-100 px-3 py-2 font-mono text-[13px] text-slate-700">
                    {row.cost_billno || "—"}
                  </td>
                  <td className={cn(amountClass(row.sale_price), "border-b border-slate-100")}>
                    {baht(row.sale_price)}
                  </td>
                  <td
                    className={cn(
                      amountClass(row.balance, "emphasis"),
                      "border-b border-emerald-100"
                    )}
                  >
                    {qty(row.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function KindPill({ kind }: { kind: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        KIND_TONE[kind] ?? "bg-slate-100 text-slate-700 ring-slate-200"
      )}
    >
      {VAT_MOVEMENT_KIND_LABEL[kind] ?? kind}
    </span>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white px-4 py-3 shadow-sm",
        accent ? "border-emerald-200" : "border-slate-200"
      )}
    >
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
          accent ? "text-emerald-950" : "text-slate-900"
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}
