"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ServerPagedTable,
  type Column,
} from "@/components/bank/ServerPagedTable";
import { TigerPayStatusBadge } from "@/components/bank/TigerPayStatusBadge";
import TigerPayTransactionDetail from "@/components/bank/TigerPayTransactionDetail";
import {
  formatBaht,
  formatBangkokDateTime,
  formatPaymentType,
} from "@/lib/bank/tiger-pay-format";
import type {
  TigerPayPaymentTypeFilter,
  TigerPayStatusGroup,
  TigerPayTransaction,
} from "@/lib/bank/tiger-pay-types";

type ListRow = Omit<TigerPayTransaction, "payload">;

export default function TigerPayTab({
  refreshToken,
}: {
  refreshToken: number;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [paymentType, setPaymentType] =
    useState<TigerPayPaymentTypeFilter>("all");
  const [statusGroup, setStatusGroup] = useState<TigerPayStatusGroup>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [rows, setRows] = useState<ListRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ListRow | null>(null);

  const hasActiveFilters = Boolean(
    search ||
      paymentType !== "all" ||
      statusGroup !== "all" ||
      from ||
      to
  );

  const fetchRows = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (paymentType !== "all") params.set("payment_type", paymentType);
        if (statusGroup !== "all") params.set("status_group", statusGroup);
        if (from) params.set("from", new Date(from).toISOString());
        if (to) params.set("to", new Date(to).toISOString());
        params.set("sort_by", "last_received_at");
        params.set("sort_dir", "desc");
        params.set("limit", String(limit));
        params.set("offset", String(offset));

        const res = await fetch(
          `/api/bank/tiger-pay/transactions?${params.toString()}`,
          { cache: "no-store", signal }
        );

        if (!res.ok) {
          throw new Error("Unable to load Tiger Pay transactions");
        }

        const data = (await res.json()) as {
          rows: ListRow[];
          count: number | null;
        };
        setRows(data.rows ?? []);
        setCount(data.count ?? null);
      } catch (e) {
        if (String(e).includes("AbortError")) return;
        setError("Unable to load Tiger Pay transactions");
        setRows([]);
        setCount(null);
      } finally {
        setLoading(false);
      }
    },
    [search, paymentType, statusGroup, from, to, limit, offset]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchRows(controller.signal);
    return () => controller.abort();
  }, [fetchRows, refreshToken]);

  function applySearch() {
    setOffset(0);
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setPaymentType("all");
    setStatusGroup("all");
    setFrom("");
    setTo("");
    setOffset(0);
  }

  const columns: Column<ListRow>[] = useMemo(
    () => [
      {
        key: "status",
        header: "Status",
        render: (r) => <TigerPayStatusBadge status={r.status} />,
      },
      {
        key: "last_received_at",
        header: "Last received",
        className: "whitespace-nowrap",
        render: (r) => formatBangkokDateTime(r.last_received_at),
      },
      {
        key: "payment_no",
        header: "Payment number",
        render: (r) => (
          <div className="min-w-[120px]">
            <div>{r.payment_no}</div>
            <div className="text-xs text-muted-foreground">
              {r.tiger_payment_id}
            </div>
          </div>
        ),
      },
      {
        key: "shop_code",
        header: "Machine",
        className: "hidden sm:table-cell",
        render: (r) => r.shop_code ?? "—",
      },
      {
        key: "shop_name",
        header: "Shop",
        className: "hidden md:table-cell",
        render: (r) => (
          <div className="min-w-[140px]">
            <div>{r.shop_name ?? "—"}</div>
            <div className="text-xs text-muted-foreground">
              {r.branch_name ?? "—"}
            </div>
          </div>
        ),
      },
      {
        key: "payment_type",
        header: "Payment type",
        render: (r) => formatPaymentType(r.payment_type),
      },
      {
        key: "amount",
        header: "Amount due",
        className: "text-right hidden lg:table-cell",
        render: (r) => formatBaht(r.amount),
      },
      {
        key: "total_pay",
        header: "Total paid",
        className: "text-right",
        render: (r) => formatBaht(r.total_pay),
      },
      {
        key: "change_amount",
        header: "Change",
        className: "text-right hidden lg:table-cell",
        render: (r) => formatBaht(r.change_amount),
      },
      {
        key: "tiger_updated_at",
        header: "Tiger updated",
        className: "whitespace-nowrap hidden xl:table-cell",
        render: (r) => formatBangkokDateTime(r.tiger_updated_at),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border p-4 bg-slate-50 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Payment no, shop, branch, refs…"
            />
          </div>

          <div className="min-w-[150px]">
            <div className="text-xs text-muted-foreground mb-1">
              Payment type
            </div>
            <Select
              value={paymentType}
              onValueChange={(v) => {
                setOffset(0);
                setPaymentType(v as TigerPayPaymentTypeFilter);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="promptpay">PromptPay</SelectItem>
                <SelectItem value="qr">Dynamic QR</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[150px]">
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <Select
              value={statusGroup}
              onValueChange={(v) => {
                setOffset(0);
                setStatusGroup(v as TigerPayStatusGroup);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="successful">Successful</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">From</div>
            <Input
              type="datetime-local"
              value={from}
              onChange={(e) => {
                setOffset(0);
                setFrom(e.target.value);
              }}
              className="w-[190px]"
            />
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">To</div>
            <Input
              type="datetime-local"
              value={to}
              onChange={(e) => {
                setOffset(0);
                setTo(e.target.value);
              }}
              className="w-[190px]"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={applySearch}>
              Search
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Tiger Pay transactions
            {count !== null && (
              <>
                {" "}
                — ทั้งหมด {count.toLocaleString("th-TH")} รายการ
              </>
            )}
          </span>
          {hasActiveFilters && (
            <Badge variant="outline">Filters active</Badge>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && (
        <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
      )}

      {!loading && rows.length === 0 && !error ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          {hasActiveFilters
            ? "No Tiger Pay transactions match the selected filters."
            : "No Tiger Pay transactions have been received yet."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <ServerPagedTable
            columns={columns}
            rows={rows}
            count={count}
            limit={limit}
            offset={offset}
            onLimitChange={setLimit}
            onOffsetChange={setOffset}
            onRowClick={(row) => {
              setSelected(row);
              setOpen(true);
            }}
          />
        </div>
      )}

      <TigerPayTransactionDetail
        open={open}
        onOpenChange={setOpen}
        selected={selected}
      />
    </div>
  );
}
