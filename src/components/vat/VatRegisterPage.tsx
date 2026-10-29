"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, ChevronDown, Columns3, FileText, Loader2, Receipt, Wallet } from "lucide-react";

import { formatBaht, formatCount } from "@/lib/bi/sales-format";
import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import SalesBillDetailDialog, {
  type SalesBillTarget,
} from "@/components/sales/SalesBillDetailDialog";
import ToBillDialog from "@/components/sales/ToBillDialog";
import { cn } from "@/lib/utils";
import {
  compareSheets,
  filterVatRegisterRows,
  summarizeVatRegister,
  summarizeVatRegisterMoney,
  vatBillDrill,
  vatReportingMonth,
  vatRequiresReceipt,
  vatTracksPayment,
  type VatExpenseImage,
  type VatFileKind,
  type VatPaidStatus,
  type VatRegisterFile,
  type VatRegisterKpiKey,
  type VatRegisterRow,
  type VatRegisterSide,
} from "@/lib/vat/register";
import {
  isVatRegisterColumnId,
  visibleVatRegisterColumns,
  vatRegisterFooterPieces,
  VAT_REGISTER_COLUMNS,
  type VatRegisterColumnId,
} from "@/lib/vat/table-columns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const COLUMN_STORAGE_KEY = "kcw-vat-register-columns";

type BranchFilter = "ALL" | "HQ" | "SYP";
type SideFilter = "ALL" | VatRegisterSide;

function readHiddenColumns(): VatRegisterColumnId[] {
  try {
    const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isVatRegisterColumnId);
  } catch {
    return [];
  }
}

function thaiDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${Number(year) + 543}`;
}

function partyHeading(side: VatRegisterSide): string {
  return side === "purchase" ? "ชื่อผู้ขายสินค้า" : "ชื่อผู้ซื้อสินค้า";
}

function moneyColumn(id: VatRegisterColumnId): boolean {
  return id === "before" || id === "vat" || id === "after";
}

function plainNowrap(id: VatRegisterColumnId): boolean {
  return id === "date" || id === "bill" || id === "taxId" || id === "status";
}

function vatCell(id: VatRegisterColumnId, row: VatRegisterRow, index: number): ReactNode {
  switch (id) {
    case "index":
      return index + 1;
    case "date":
      return thaiDate(row.bill_date);
    case "bill":
      return <BillNumber row={row} />;
    case "party":
      return (
        <span className="block max-w-[16rem]">
          <PartyLines row={row} />
        </span>
      );
    case "taxId":
      return row.tax_id || "—";
    case "before":
      return formatBaht(row.before_vat, true);
    case "vat":
      return formatBaht(row.vat, true);
    case "after":
      return formatBaht(row.after_vat, true);
    case "detail":
      return (
        <span className="block max-w-[14rem] truncate" title={row.detail ?? undefined}>
          {row.detail || "—"}
        </span>
      );
    case "status":
      return paymentLabel(row) ?? "—";
    case "docs":
      return documentLabel(row);
  }
}

export default function VatRegisterPage({ readOnly = false }: { readOnly?: boolean }) {
  const [month, setMonth] = useState(vatReportingMonth);
  const [branch, setBranch] = useState<BranchFilter>("ALL");
  const [side, setSide] = useState<SideFilter>("ALL");
  const [sheet, setSheet] = useState<string>("ALL");
  const [kpiOpen, setKpiOpen] = useState(true);
  const [kpi, setKpi] = useState<VatRegisterKpiKey | null>(null);
  const [rows, setRows] = useState<VatRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VatRegisterRow | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<VatRegisterColumnId[]>([]);
  const [columnsHydrated, setColumnsHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [savingUse, setSavingUse] = useState<ReadonlySet<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month });
      if (branch !== "ALL") params.set("branch", branch);
      if (side !== "ALL") params.set("side", side);
      const res = await fetch(`/api/vat/register?${params.toString()}`);
      const json = (await res.json()) as { rows?: VatRegisterRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "โหลดรายงานไม่สำเร็จ");
      setRows(json.rows ?? []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [month, branch, side]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setHiddenColumns(readHiddenColumns());
    setColumnsHydrated(true);
  }, []);

  useEffect(() => {
    if (!columnsHydrated) return;
    try {
      window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(hiddenColumns));
    } catch {
      // private mode / disabled storage
    }
  }, [columnsHydrated, hiddenColumns]);

  const sheets = useMemo(() => {
    const names = Array.from(new Set(rows.map((row) => row.sheet)));
    names.sort(compareSheets);
    return names;
  }, [rows]);

  useEffect(() => {
    if (sheet !== "ALL" && !sheets.includes(sheet)) setSheet("ALL");
  }, [sheet, sheets]);

  const sheetRows = useMemo(
    () => (sheet === "ALL" ? rows : rows.filter((row) => row.sheet === sheet)),
    [rows, sheet]
  );

  const kpis = useMemo(
    () => summarizeVatRegister(sheetRows.filter((row) => !row.accounting_unused)),
    [sheetRows]
  );
  const showPayment = sheet === "ALL" || vatTracksPayment(sheet);
  const showReceipts = sheet === "ALL" || vatRequiresReceipt(sheet);
  const shownColumns = useMemo(
    () => visibleVatRegisterColumns(hiddenColumns, showPayment),
    [hiddenColumns, showPayment]
  );

  function setColumnVisible(id: VatRegisterColumnId, nextVisible: boolean) {
    setHiddenColumns((current) => {
      const availableIds = VAT_REGISTER_COLUMNS.filter(
        (column) => !("paymentOnly" in column && column.paymentOnly) || showPayment
      ).map((column) => column.id);
      let visibleIds = availableIds.filter((columnId) => !current.includes(columnId));
      if (visibleIds.length === 0) visibleIds = [...availableIds];
      const nextVisibleIds = nextVisible
        ? Array.from(new Set([...visibleIds, id]))
        : visibleIds.filter((columnId) => columnId !== id);
      if (nextVisibleIds.length === 0) return current;
      const unavailableHidden = current.filter((columnId) => !availableIds.includes(columnId));
      const nextHidden = availableIds.filter((columnId) => !nextVisibleIds.includes(columnId));
      return [...unavailableHidden, ...nextHidden];
    });
  }

  useEffect(() => {
    if (!showPayment && kpi === "unpaid") setKpi(null);
    if (!showReceipts && kpi === "missing_receipt") setKpi(null);
  }, [showPayment, showReceipts, kpi]);

  const visible = useMemo(
    () => filterVatRegisterRows(sheetRows, { query, kpi }),
    [sheetRows, query, kpi]
  );

  const totals = useMemo(() => summarizeVatRegisterMoney(visible), [visible]);

  const headingSide: VatRegisterSide =
    side === "purchase" || sheetRows.every((row) => row.side === "purchase")
      ? "purchase"
      : "sales";

  function toggleKpi(key: VatRegisterKpiKey) {
    setKpi((current) => (current === key ? null : key));
  }

  function patchRow(lineKey: string, patch: Partial<VatRegisterRow>) {
    setRows((current) =>
      current.map((row) => (row.line_key === lineKey ? { ...row, ...patch } : row))
    );
    setSelected((current) =>
      current && current.line_key === lineKey ? { ...current, ...patch } : current
    );
  }

  async function setAccountingUnused(row: VatRegisterRow, unused: boolean) {
    if (
      readOnly ||
      row.full_invoice_docno ||
      unused === row.accounting_unused ||
      savingUse.has(row.line_key)
    ) {
      return;
    }
    setSaveError(null);
    setSavingUse((current) => new Set(current).add(row.line_key));
    patchRow(row.line_key, { accounting_unused: unused });
    try {
      const res = await fetch(`/api/vat/register/${row.line_key}/use`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: row.branch,
          side: row.side,
          sheet: row.sheet,
          billNo: row.bill_no,
          billDate: row.bill_date,
          sourceRef: row.source_ref,
          reportMonth: row.report_month,
          accountingUnused: unused,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
    } catch (err) {
      patchRow(row.line_key, { accounting_unused: !unused });
      setSaveError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingUse((current) => {
        const next = new Set(current);
        next.delete(row.line_key);
        return next;
      });
    }
  }

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">รายงานภาษีขาย / ภาษีซื้อ</h1>
        <p className="text-sm text-slate-600">
          {readOnly
            ? "ดูได้อย่างเดียว"
            : "เล่มเดียวกับรายงาน Excel แนบใบกำกับได้ทุกเล่ม ส่วนขาย TD กับซื้อเครดิตแนบใบเสร็จด้วย ติ๊กรายการที่บัญชีไม่ใช้ ยอดรวมจะนับเฉพาะรายการที่ใช้งาน"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">เดือน</span>
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="w-full"
          />
        </label>
        <FilterSelect
          label="สาขา"
          value={branch}
          onChange={(value) => setBranch(value as BranchFilter)}
          options={[
            ["ALL", "ทั้งหมด"],
            ["HQ", "สำนักงานใหญ่"],
            ["SYP", "สาขา"],
          ]}
        />
        <FilterSelect
          label="ประเภท"
          value={side}
          onChange={(value) => setSide(value as SideFilter)}
          options={[
            ["ALL", "ทั้งหมด"],
            ["sales", "ภาษีขาย"],
            ["purchase", "ภาษีซื้อ"],
          ]}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-900"
          aria-expanded={kpiOpen}
          onClick={() => setKpiOpen((open) => !open)}
        >
          สรุปเดือนนี้
          <ChevronDown
            className={cn("h-4 w-4 text-slate-500 transition-transform", kpiOpen && "rotate-180")}
          />
        </button>
        {kpiOpen ? (
          <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2 xl:grid-cols-4">
            {showReceipts ? (
              <KpiFilterCard
                title="ใบเสร็จที่ยังไม่มี"
                value={formatCount(kpis.missingReceipts)}
                hint={formatBaht(kpis.missingReceiptAmount, true)}
                icon={<Receipt className="h-4 w-4" />}
                pressed={kpi === "missing_receipt"}
                alert={kpis.missingReceipts > 0}
                onClick={() => toggleKpi("missing_receipt")}
              />
            ) : null}
            <KpiFilterCard
              title="ใบกำกับที่ยังไม่มี"
              value={formatCount(kpis.missingInvoices)}
              hint={formatBaht(kpis.missingInvoiceAmount, true)}
              icon={<FileText className="h-4 w-4" />}
              pressed={kpi === "missing_invoice"}
              alert={kpis.missingInvoices > 0}
              onClick={() => toggleKpi("missing_invoice")}
            />
            {showPayment ? (
              <KpiFilterCard
                title="ยังไม่จ่าย"
                value={formatCount(kpis.unpaid)}
                hint={formatBaht(kpis.unpaidAmount, true)}
                icon={<Wallet className="h-4 w-4" />}
                pressed={kpi === "unpaid"}
                onClick={() => toggleKpi("unpaid")}
              />
            ) : null}
            <KpiFilterCard
              title="เอกสารครบ"
              value={`${kpis.completePct}%`}
              hint={`${formatCount(kpis.complete)} / ${formatCount(kpis.total)} รายการ`}
              icon={<BadgeCheck className="h-4 w-4" />}
              pressed={kpi === "complete"}
              onClick={() => toggleKpi("complete")}
            />
          </div>
        ) : null}
      </section>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <SheetButton active={sheet === "ALL"} onClick={() => setSheet("ALL")}>
          ทั้งหมด
        </SheetButton>
        {sheets.map((name) => (
          <SheetButton key={name} active={sheet === name} onClick={() => setSheet(name)}>
            {name}
          </SheetButton>
        ))}
      </div>

      <label className="flex max-w-md flex-col gap-1 text-sm">
        <span className="text-slate-600">ค้นหาบิล</span>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="เลขที่บิล ชื่อคู่ค้า หรือเลขผู้เสียภาษี"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}

      <div className="flex flex-col gap-2 md:hidden">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{emptyVatRegisterLabel(query, kpi)}</p>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium">{vatRegisterTotalLabel(totals.used, totals.unused)}</p>
              <p className="mt-1 text-slate-700">
                มูลค่า {formatBaht(totals.before, true)} · ภาษี {formatBaht(totals.vat, true)}
              </p>
              <p className="font-medium">สุทธิ {formatBaht(totals.after, true)}</p>
            </div>
            {visible.map((row) => {
              const paid = paymentLabel(row);
              return (
                <div
                  key={row.line_key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(row);
                    }
                  }}
                  className={cn(
                    "rounded-xl border border-slate-200 p-3 text-left",
                    row.accounting_unused ? "bg-amber-50 text-slate-500" : "bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">
                        {row.sheet} · {thaiDate(row.bill_date)}
                      </p>
                      <BillNumber row={row} />
                      <PartyLines row={row} />
                    </div>
                    <p className="shrink-0 text-sm font-medium">{formatBaht(row.after_vat, true)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-600">
                      {paid ? `${paid} · ` : ""}
                      {documentLabel(row)}
                    </p>
                    <AccountingUnusedToggle
                      checked={row.accounting_unused}
                      locked={Boolean(row.full_invoice_docno)}
                      disabled={readOnly || savingUse.has(row.line_key)}
                      onChange={(unused) => void setAccountingUnused(row, unused)}
                    />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="hidden min-w-0 max-w-full flex-col gap-2 md:flex">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {loading
              ? "กำลังโหลด…"
              : visible.length === 0
                ? "0 รายการ"
                : vatRegisterTotalLabel(totals.used, totals.unused)}
          </p>
          <ColumnPicker
            hidden={hiddenColumns}
            showPayment={showPayment}
            headingSide={headingSide}
            onToggle={setColumnVisible}
            onReset={() => setHiddenColumns([])}
          />
        </div>
        <div className="min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white">
          <table className="w-max min-w-full text-left text-sm text-slate-900">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th
                  className="sticky left-0 z-20 w-12 bg-slate-50 px-2 py-2 font-medium whitespace-nowrap"
                  title="ติ๊กเมื่อบัญชีไม่ใช้รายการนี้ ยอดรวมจะไม่นับ"
                >
                  ไม่ใช้
                </th>
                {shownColumns.map((column) => (
                  <th
                    key={column.id}
                    className={cn(
                      "px-3 py-2 font-medium whitespace-nowrap",
                      moneyColumn(column.id) && "text-right",
                      column.id === "index" &&
                        "sticky left-12 z-10 bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]"
                    )}
                  >
                    {column.id === "party" ? partyHeading(headingSide) : column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-3 py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={shownColumns.length + 1} className="px-3 py-10 text-center text-slate-500">
                    {emptyVatRegisterLabel(query, kpi)}
                  </td>
                </tr>
              ) : (
                visible.map((row, index) => (
                  <tr
                    key={row.line_key}
                    className={cn(
                      "group cursor-pointer border-t border-slate-100",
                      row.accounting_unused
                        ? "bg-amber-50 text-slate-500 hover:bg-amber-100"
                        : "hover:bg-slate-50"
                    )}
                    onClick={() => setSelected(row)}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-20 w-12 px-2 py-2",
                        row.accounting_unused
                          ? "bg-amber-50 group-hover:bg-amber-100"
                          : "bg-white group-hover:bg-slate-50"
                      )}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <AccountingUnusedToggle
                        checked={row.accounting_unused}
                        locked={Boolean(row.full_invoice_docno)}
                        disabled={readOnly || savingUse.has(row.line_key)}
                        onChange={(unused) => void setAccountingUnused(row, unused)}
                      />
                    </td>
                    {shownColumns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          "px-3 py-2 align-middle",
                          moneyColumn(column.id) && "text-right tabular-nums whitespace-nowrap",
                          plainNowrap(column.id) && "whitespace-nowrap",
                          column.id === "docs" && "whitespace-nowrap text-slate-600",
                          column.id === "index" &&
                            "sticky left-12 z-10 whitespace-nowrap shadow-[1px_0_0_0_#e2e8f0]",
                          column.id === "index" &&
                            (row.accounting_unused
                              ? "bg-amber-50 group-hover:bg-amber-100"
                              : "bg-white group-hover:bg-slate-50")
                        )}
                      >
                        {vatCell(column.id, row, index)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {!loading && visible.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                  {vatRegisterFooterPieces(["use", ...shownColumns.map((column) => column.id)]).map(
                    (piece, pieceIndex) => {
                      if (piece.type === "label") {
                        return (
                          <td key="label" className="px-3 py-2" colSpan={piece.span}>
                            {vatRegisterTotalLabel(totals.used, totals.unused)}
                          </td>
                        );
                      }
                      if (piece.type === "money") {
                        return (
                          <td
                            key={piece.id}
                            className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
                          >
                            {formatBaht(totals[piece.id], true)}
                          </td>
                        );
                      }
                      return <td key={`gap-${pieceIndex}`} colSpan={piece.span} />;
                    }
                  )}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      <LineDialog
        row={selected}
        readOnly={readOnly}
        savingUse={selected != null && savingUse.has(selected.line_key)}
        onClose={() => setSelected(null)}
        onSaved={patchRow}
        onAccountingUnused={(row, unused) => void setAccountingUnused(row, unused)}
      />
    </main>
  );
}

function BillNumber({ row }: { row: VatRegisterRow }) {
  return (
    <span className="block min-w-0">
      <span className="block">{row.display_bill_no}</span>
      {row.full_invoice_docno ? (
        <span className="block text-xs font-normal text-slate-500">
          ออกใบเต็มแล้ว: {row.full_invoice_docno}
        </span>
      ) : null}
    </span>
  );
}

function PartyLines({ row }: { row: VatRegisterRow }) {
  const name = row.party_name?.trim() || "";
  const code = row.side === "purchase" ? row.party_code?.trim() || "" : "";
  if (!name && !code) return <>—</>;
  return (
    <span className="block min-w-0">
      {name ? <span className="block truncate">{name}</span> : null}
      {code ? <span className="block font-mono text-xs text-slate-500">{code}</span> : null}
    </span>
  );
}

function emptyVatRegisterLabel(query: string, kpi: VatRegisterKpiKey | null): string {
  if (query.trim() && kpi) return "ไม่พบบิลในกลุ่มนี้";
  if (query.trim()) return "ไม่พบบิลที่ค้นหา";
  if (kpi) return "ไม่มีรายการในกลุ่มนี้";
  return "ไม่มีรายการในเดือนนี้";
}

function vatRegisterTotalLabel(used: number, unused: number): string {
  const usedLabel = `รวม ${used.toLocaleString("th-TH")} รายการ`;
  if (unused === 0) return usedLabel;
  return `${usedLabel} · ไม่รวม ${unused.toLocaleString("th-TH")} ที่บัญชีไม่ใช้`;
}

function AccountingUnusedToggle({
  checked,
  disabled,
  locked = false,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  locked?: boolean;
  onChange: (unused: boolean) => void;
}) {
  return (
    <label
      className="inline-flex items-center gap-1.5 text-xs text-slate-600"
      title={locked ? "ออกใบเต็มแล้ว จึงไม่นับใบย่อ" : "ติ๊กเมื่อบัญชีไม่ใช้รายการนี้ ยอดรวมจะไม่นับ"}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        disabled={disabled || locked}
        aria-label="บัญชีไม่ใช้"
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span className="md:sr-only">บัญชีไม่ใช้</span>
    </label>
  );
}

function paymentLabel(row: VatRegisterRow): string | null {
  if (!vatTracksPayment(row.sheet)) return null;
  return row.paid_status === "paid" ? "จ่ายแล้ว" : "ยังไม่จ่าย";
}

function documentLabel(row: VatRegisterRow): string {
  const invoice = `ใบกำกับ ${row.invoice_count}`;
  if (!vatRequiresReceipt(row.sheet)) return invoice;
  return `${invoice} · ใบเสร็จ ${row.receipt_count}`;
}

function KpiFilterCard({
  title,
  value,
  hint,
  icon,
  pressed,
  alert = false,
  onClick,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ReactNode;
  pressed: boolean;
  alert?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={pressed}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer text-left"
    >
      <SalesKpiCard
        title={title}
        value={value}
        hint={hint}
        icon={icon}
        className={cn(
          "h-full",
          alert && "border-rose-300",
          pressed && "ring-2 ring-slate-900"
        )}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([id, text]) => (
            <SelectItem key={id} value={id}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ColumnPicker({
  hidden,
  showPayment,
  headingSide,
  onToggle,
  onReset,
}: {
  hidden: readonly VatRegisterColumnId[];
  showPayment: boolean;
  headingSide: VatRegisterSide;
  onToggle: (id: VatRegisterColumnId, visible: boolean) => void;
  onReset: () => void;
}) {
  const columns = VAT_REGISTER_COLUMNS.filter(
    (column) => !("paymentOnly" in column && column.paymentOnly) || showPayment
  );
  const shown = new Set(
    visibleVatRegisterColumns(hidden, showPayment).map((column) => column.id)
  );
  const hiddenCount = columns.filter((column) => !shown.has(column.id)).length;
  const visibleCount = columns.length - hiddenCount;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
          <Columns3 className="h-4 w-4" />
          คอลัมน์
          {hiddenCount > 0 ? (
            <span className="text-xs text-slate-500">
              {visibleCount}/{columns.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>เลือกคอลัมน์</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const checked = shown.has(column.id);
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={checked}
              disabled={checked && visibleCount <= 1}
              onCheckedChange={(value) => onToggle(column.id, value === true)}
              onSelect={(event) => event.preventDefault()}
            >
              {column.id === "party" ? partyHeading(headingSide) : column.label}
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={hiddenCount === 0} onSelect={onReset}>
          แสดงทั้งหมด
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SheetButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "shrink-0 rounded-full bg-slate-900 px-3 py-1 text-sm text-white"
          : "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
      }
    >
      {children}
    </button>
  );
}

function LineDialog({
  row,
  readOnly,
  savingUse,
  onClose,
  onSaved,
  onAccountingUnused,
}: {
  row: VatRegisterRow | null;
  readOnly: boolean;
  savingUse: boolean;
  onClose: () => void;
  onSaved: (lineKey: string, patch: Partial<VatRegisterRow>) => void;
  onAccountingUnused: (row: VatRegisterRow, unused: boolean) => void;
}) {
  const [paidStatus, setPaidStatus] = useState<VatPaidStatus>("unpaid");
  const [paidOn, setPaidOn] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<VatRegisterFile[]>([]);
  const [expenseFiles, setExpenseFiles] = useState<VatExpenseImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [billTarget, setBillTarget] = useState<SalesBillTarget | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [toDocno, setToDocno] = useState<string | null>(null);
  const detailOpen = billTarget !== null || expenseOpen || toDocno !== null;
  const drill = row ? vatBillDrill(row) : null;

  const loadFiles = useCallback(async (lineKey: string, reportMonth: string) => {
    const params = new URLSearchParams({ month: reportMonth });
    const res = await fetch(`/api/vat/register/${lineKey}/files?${params}`);
    const json = (await res.json()) as {
      files?: VatRegisterFile[];
      expenseFiles?: VatExpenseImage[];
      error?: string;
    };
    if (!res.ok) throw new Error(json.error || "โหลดไฟล์ไม่สำเร็จ");
    setFiles(json.files ?? []);
    setExpenseFiles(json.expenseFiles ?? []);
  }, []);

  useEffect(() => {
    if (!row) {
      setBillTarget(null);
      setExpenseOpen(false);
      setToDocno(null);
      return;
    }
    setPaidStatus(row.paid_status);
    setPaidOn(row.paid_on ?? "");
    setNote(row.note ?? "");
    setMessage(null);
    setFiles([]);
    setExpenseFiles([]);
    setBillTarget(null);
    setExpenseOpen(false);
    setToDocno(null);
    void loadFiles(row.line_key, row.report_month).catch((err: unknown) => {
      setMessage(err instanceof Error ? err.message : "โหลดไฟล์ไม่สำเร็จ");
    });
  }, [row, loadFiles]);

  async function savePaid() {
    if (!row) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/vat/register/${row.line_key}/paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch: row.branch,
          side: row.side,
          sheet: row.sheet,
          billNo: row.bill_no,
          billDate: row.bill_date,
          sourceRef: row.source_ref,
          reportMonth: row.report_month,
          paidStatus,
          paidOn: paidStatus === "paid" && paidOn ? paidOn : null,
          note,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      onSaved(row.line_key, {
        paid_status: paidStatus,
        paid_on: paidStatus === "paid" && paidOn ? paidOn : null,
        note: note.trim() || null,
      });
      setMessage("บันทึกแล้ว");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: VatFileKind, file: File | undefined) {
    if (!row || !file) return;
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      body.set("reportMonth", row.report_month);
      const res = await fetch(`/api/vat/register/${row.line_key}/files`, {
        method: "POST",
        body,
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "อัปโหลดไม่สำเร็จ");
      await loadFiles(row.line_key, row.report_month);
      const invoiceCount =
        kind === "invoice" ? row.invoice_count + 1 : row.invoice_count;
      const receiptCount =
        kind === "receipt" ? row.receipt_count + 1 : row.receipt_count;
      onSaved(row.line_key, {
        invoice_count: invoiceCount,
        receipt_count: receiptCount,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function removeFile(fileId: string, kind: VatFileKind) {
    if (!row) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/vat/register/${row.line_key}/files/${fileId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "ลบไฟล์ไม่สำเร็จ");
      await loadFiles(row.line_key, row.report_month);
      onSaved(row.line_key, {
        invoice_count:
          kind === "invoice" ? Math.max(0, row.invoice_count - 1) : row.invoice_count,
        receipt_count:
          kind === "receipt" ? Math.max(0, row.receipt_count - 1) : row.receipt_count,
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ลบไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <Dialog open={row != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] w-[calc(100vw-1.5rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6"
        onInteractOutside={(event) => {
          if (detailOpen) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (detailOpen) event.preventDefault();
        }}
      >
        {row ? (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>
                {row.sheet} · {row.display_bill_no}
              </DialogTitle>
              {row.full_invoice_docno ? (
                <p className="text-sm text-slate-600">ออกใบเต็มแล้ว: {row.full_invoice_docno}</p>
              ) : null}
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-slate-500">วันที่</dt>
                <dd>{thaiDate(row.bill_date)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">ยอดสุทธิ</dt>
                <dd>{formatBaht(row.after_vat, true)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">{partyHeading(row.side)}</dt>
                <dd>
                  <PartyLines row={row} />
                </dd>
              </div>
              {row.remark ? (
                <div className="col-span-2">
                  <dt className="text-slate-500">หมายเหตุ</dt>
                  <dd>{row.remark}</dd>
                </div>
              ) : null}
            </dl>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={row.accounting_unused}
                disabled={readOnly || savingUse || Boolean(row.full_invoice_docno)}
                aria-label="บัญชีไม่ใช้"
                onCheckedChange={(value) => onAccountingUnused(row, value === true)}
              />
              {row.full_invoice_docno
                ? "บัญชีไม่ใช้ — ออกใบเต็มแล้ว จึงไม่นับใบย่อ"
                : "บัญชีไม่ใช้ — ไม่รวมในยอดรวม"}
            </label>

            {row.full_invoice_docno || row.source === "to_bill" ? (
              <button
                type="button"
                className="text-left text-sm font-medium text-sky-800 underline"
                onClick={() => setToDocno(row.full_invoice_docno || row.bill_no)}
              >
                เปิดใบเต็ม {row.full_invoice_docno || row.bill_no}
              </button>
            ) : null}

            {drill ? (
              <button
                type="button"
                className="text-left text-sm font-medium text-sky-800 underline"
                onClick={() => setBillTarget(drill)}
              >
                ดูรายการในบิล
              </button>
            ) : row.source === "expense" ? (
              <button
                type="button"
                className="text-left text-sm font-medium text-sky-800 underline"
                onClick={() => setExpenseOpen(true)}
              >
                ดูรายการในบิล
              </button>
            ) : null}

            <div className="grid gap-3">
              {vatTracksPayment(row.sheet) ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      <span>สถานะจ่ายเงิน</span>
                      <Select
                        value={paidStatus}
                        onValueChange={(value) => setPaidStatus(value as VatPaidStatus)}
                        disabled={readOnly || busy || row.paid_from_reminder}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unpaid">ยังไม่จ่าย</SelectItem>
                          <SelectItem value="paid">จ่ายแล้ว</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span>วันที่จ่าย</span>
                      <Input
                        type="date"
                        value={paidOn}
                        disabled={readOnly || busy || paidStatus !== "paid"}
                        onChange={(event) => setPaidOn(event.target.value)}
                      />
                    </label>
                  </div>
                  {row.paid_from_reminder ? (
                    <p className="text-sm text-slate-600">สถานะจ่ายมาจากใบวางบิลที่จ่ายแล้ว</p>
                  ) : null}
                </>
              ) : null}
              <label className="grid gap-1 text-sm">
                <span>บันทึก</span>
                <Textarea
                  value={note}
                  disabled={readOnly || busy}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                />
              </label>
              {readOnly ? null : (
                <Button type="button" onClick={() => void savePaid()} disabled={busy}>
                  บันทึกสถานะ
                </Button>
              )}
            </div>

            <FileGroup
              title="ใบกำกับ"
              files={files.filter((file) => file.kind === "invoice")}
              readOnly={readOnly}
              busy={busy}
              onUpload={(file) => void upload("invoice", file)}
              onDelete={(id) => void removeFile(id, "invoice")}
            />
            {vatRequiresReceipt(row.sheet) ? (
              <FileGroup
                title="ใบเสร็จ"
                files={files.filter((file) => file.kind === "receipt")}
                readOnly={readOnly}
                busy={busy}
                onUpload={(file) => void upload("receipt", file)}
                onDelete={(id) => void removeFile(id, "receipt")}
              />
            ) : null}

            {expenseFiles.length > 0 ? (
              <section className="grid gap-2">
                <h3 className="text-sm font-medium">รูปค่าใช้จ่ายเดิม</h3>
                <div className="flex flex-wrap gap-2">
                  {expenseFiles.map((file) => (
                    <a key={file.name} href={file.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={file.url}
                        alt={file.name}
                        className="h-20 w-20 rounded border object-cover"
                      />
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
    <SalesBillDetailDialog
      target={billTarget}
      open={billTarget !== null}
      onOpenChange={(open) => {
        if (!open) setBillTarget(null);
      }}
    />
    <ToBillDialog
      docno={toDocno}
      open={toDocno !== null}
      onOpenChange={(open) => {
        if (!open) setToDocno(null);
      }}
      onOpenTad={(billno) =>
        setBillTarget({ billno, docType: "TAD", source: "sales" })
      }
    />
    <ExpenseLinesDialog
      lineKey={row?.line_key ?? ""}
      month={row?.report_month ?? ""}
      billNo={row?.display_bill_no ?? ""}
      open={expenseOpen}
      onOpenChange={setExpenseOpen}
    />
    </>
  );
}

type ExpenseLine = {
  id: string;
  detail: string | null;
  quantity: number;
  price: number;
  amount: number;
};

function ExpenseLinesDialog({
  lineKey,
  month,
  billNo,
  open,
  onOpenChange,
}: {
  lineKey: string;
  month: string;
  billNo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const requestKey = open && lineKey ? `${lineKey}|${month}` : "";
  const [loadedKey, setLoadedKey] = useState("");
  const [lines, setLines] = useState<ExpenseLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    const params = new URLSearchParams({ month });
    void fetch(`/api/vat/register/${lineKey}/lines?${params.toString()}`)
      .then(async (res) => {
        const json = (await res.json()) as { lines?: ExpenseLine[]; error?: string };
        if (!res.ok) throw new Error(json.error || "โหลดรายการไม่สำเร็จ");
        if (!cancelled) {
          setLines(json.lines ?? []);
          setError(null);
          setLoadedKey(requestKey);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLines([]);
          setError(err instanceof Error ? err.message : "โหลดรายการไม่สำเร็จ");
          setLoadedKey(requestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, lineKey, month]);

  const loading = requestKey !== "" && loadedKey !== requestKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[80]"
        className="left-0 top-0 z-[80] flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(92dvh,880px)] sm:w-[min(840px,calc(100vw-2rem))] sm:max-w-none sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
      >
        <DialogHeader className="shrink-0 space-y-2 border-b px-4 py-4 pr-12 text-left">
          <DialogTitle className="text-base sm:text-lg">
            {billNo || "รายการค่าใช้จ่าย"}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {loading ? (
            <p className="py-6 text-sm text-slate-500">กำลังโหลด</p>
          ) : error ? (
            <p className="py-6 text-sm text-red-600">{error}</p>
          ) : lines.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">ไม่มีรายการ</p>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="border-b bg-slate-50 p-2 font-medium">รายละเอียด</th>
                    <th className="border-b bg-slate-50 p-2 font-medium">จำนวน</th>
                    <th className="border-b bg-slate-50 p-2 font-medium">ราคา</th>
                    <th className="border-b bg-slate-50 p-2 font-medium">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-b">
                      <td className="p-2">{line.detail || "—"}</td>
                      <td className="p-2 tabular-nums">{line.quantity}</td>
                      <td className="p-2 tabular-nums">{formatBaht(line.price, true)}</td>
                      <td className="p-2 tabular-nums">{formatBaht(line.amount, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileGroup({
  title,
  files,
  readOnly,
  busy,
  onUpload,
  onDelete,
}: {
  title: string;
  files: VatRegisterFile[];
  readOnly: boolean;
  busy: boolean;
  onUpload: (file: File | undefined) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {readOnly ? null : (
          <Label className="cursor-pointer text-sm text-slate-700 underline">
            เพิ่มไฟล์
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                onUpload(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </Label>
        )}
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-slate-500">ยังไม่มี{title}</p>
      ) : (
        <ul className="grid gap-2">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
              <a href={file.url} target="_blank" rel="noreferrer" className="truncate underline">
                {file.content_type === "application/pdf" ? `${title} PDF` : title}
              </a>
              {readOnly ? null : (
                <button
                  type="button"
                  className="text-red-600"
                  disabled={busy}
                  onClick={() => onDelete(file.id)}
                >
                  ลบ
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
