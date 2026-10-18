import Link from "next/link";

import {
  VAT_INVENTORY_PAGE_SIZE,
  type VatInventoryDetail,
  type VatInventoryList,
  type VatInventorySummary,
} from "@/lib/vat/inventory";

const KIND_LABEL: Record<string, string> = {
  OPEN: "ยกมา",
  PI: "ซื้อ VAT",
  RV: "RV",
  SALE: "ขาย VAT",
  TAR: "TAR",
  SA: "ปรับสต็อก",
};

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

export function VatInventoryListView({
  basePath,
  summary,
  list,
  search,
  offset,
}: {
  basePath: string;
  summary: VatInventorySummary;
  list: VatInventoryList;
  search: string;
  offset: number;
}) {
  const page = Math.floor(offset / VAT_INVENTORY_PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(list.total / VAT_INVENTORY_PAGE_SIZE));
  const query = (nextOffset: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    const text = params.toString();
    return text ? `${basePath}?${text}` : basePath;
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">สต็อกภาษี</h1>
        <p className="text-sm text-slate-600">
          คงเหลือภาษี = ยกมา VAT + ซื้อ VAT + RV − ขาย TR/TD/TAD − TAR − ปรับสต็อก
          {summary.rebuilt_at
            ? ` · คำนวณเมื่อ ${thaiDate(summary.rebuilt_at)}`
            : ""}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="มูลค่าคงเหลือ" value={baht(summary.value)} />
        <Metric label="จำนวนคงเหลือ" value={qty(summary.qty)} />
        <Metric label="รหัสสินค้า" value={qty(summary.products)} />
      </div>
      <form className="flex gap-2" action={basePath}>
        <input
          name="q"
          defaultValue={search}
          placeholder="รหัสหรือชื่อสินค้า"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
        >
          ค้นหา
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">รหัส</th>
              <th className="px-3 py-2">ชื่อ</th>
              <th className="px-3 py-2 text-right">ยกมา</th>
              <th className="px-3 py-2 text-right">ซื้อ VAT</th>
              <th className="px-3 py-2 text-right">RV</th>
              <th className="px-3 py-2 text-right">ขาย VAT</th>
              <th className="px-3 py-2 text-right">TAR</th>
              <th className="px-3 py-2 text-right">ปรับสต็อก</th>
              <th className="px-3 py-2 text-right">คงเหลือภาษี</th>
              <th className="px-3 py-2 text-right">มูลค่า</th>
              <th className="px-3 py-2 text-right">คงเหลือจริง</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((row) => (
              <tr key={row.bcode} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  <Link
                    href={`${basePath}/${encodeURIComponent(row.bcode)}`}
                    className="text-sky-700 hover:underline"
                  >
                    {row.bcode}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.descr}</td>
                <td className="px-3 py-2 text-right">{qty(row.open_qty)}</td>
                <td className="px-3 py-2 text-right">{qty(row.purchase_qty)}</td>
                <td className="px-3 py-2 text-right">{qty(row.rv_qty)}</td>
                <td className="px-3 py-2 text-right">{qty(row.sale_qty)}</td>
                <td className="px-3 py-2 text-right">{qty(row.tar_qty)}</td>
                <td className="px-3 py-2 text-right">{qty(row.sa_qty)}</td>
                <td className="px-3 py-2 text-right font-medium">{qty(row.qty)}</td>
                <td className="px-3 py-2 text-right">{baht(row.value)}</td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {qty(row.actual_qty)}
                </td>
              </tr>
            ))}
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                  ยังไม่มีรายการ
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {list.total} รายการ · หน้า {page}/{pages}
        </span>
        <span className="flex gap-3">
          {offset > 0 ? (
            <Link href={query(Math.max(0, offset - VAT_INVENTORY_PAGE_SIZE))}>
              ก่อนหน้า
            </Link>
          ) : null}
          {offset + VAT_INVENTORY_PAGE_SIZE < list.total ? (
            <Link href={query(offset + VAT_INVENTORY_PAGE_SIZE)}>ถัดไป</Link>
          ) : null}
        </span>
      </div>
    </main>
  );
}

export function VatInventoryDrillView({
  basePath,
  detail,
}: {
  basePath: string;
  detail: VatInventoryDetail;
}) {
  const product = detail.product;
  if (!product) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-slate-600">ไม่พบรหัสสินค้านี้ในสต็อกภาษี</p>
        <Link href={basePath} className="mt-3 inline-block text-sm text-sky-700">
          กลับไปหน้ารายการ
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div>
        <Link href={basePath} className="text-sm text-sky-700">
          กลับไปหน้ารายการ
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {product.bcode} {product.descr}
        </h1>
        <p className="text-sm text-slate-600">
          คงเหลือภาษี {qty(product.qty)} · มูลค่า {baht(product.value)} · คงเหลือจริง{" "}
          {qty(product.actual_qty)}
        </p>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-slate-900">ที่มาของของคงเหลือ</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">วันที่</th>
                <th className="px-3 py-2">เอกสาร</th>
                <th className="px-3 py-2">แหล่ง</th>
                <th className="px-3 py-2">ผู้ขาย</th>
                <th className="px-3 py-2 text-right">จำนวนคงเหลือ</th>
                <th className="px-3 py-2 text-right">ทุน/หน่วย</th>
                <th className="px-3 py-2 text-right">มูลค่า</th>
              </tr>
            </thead>
            <tbody>
              {detail.layers.map((layer) => (
                <tr
                  key={`${layer.billno}-${layer.billdate}-${layer.qty}`}
                  className="border-t border-slate-100"
                >
                  <td className="px-3 py-2">{thaiDate(layer.billdate)}</td>
                  <td className="px-3 py-2">{layer.billno}</td>
                  <td className="px-3 py-2">{layer.source === "RV" ? "RV" : "ซื้อ"}</td>
                  <td className="px-3 py-2">{layer.supplier}</td>
                  <td className="px-3 py-2 text-right">{qty(layer.qty)}</td>
                  <td className="px-3 py-2 text-right">{baht(layer.unit_cost)}</td>
                  <td className="px-3 py-2 text-right">
                    {baht(layer.qty * layer.unit_cost)}
                  </td>
                </tr>
              ))}
              {detail.layers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    ไม่มีของคงเหลือที่จับทุนได้
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-slate-900">ความเคลื่อนไหวปี 2026</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">วันที่</th>
                <th className="px-3 py-2">เอกสาร</th>
                <th className="px-3 py-2">ประเภท</th>
                <th className="px-3 py-2">สาขา</th>
                <th className="px-3 py-2 text-right">จำนวน</th>
                <th className="px-3 py-2 text-right">คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {detail.movements.map((row, index) => (
                <tr key={`${row.billdate}-${row.billno}-${index}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">{thaiDate(row.billdate)}</td>
                  <td className="px-3 py-2">{row.billno}</td>
                  <td className="px-3 py-2">{KIND_LABEL[row.kind] ?? row.kind}</td>
                  <td className="px-3 py-2">{row.site.toUpperCase()}</td>
                  <td className="px-3 py-2 text-right">{qty(row.qty)}</td>
                  <td className="px-3 py-2 text-right">{qty(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
