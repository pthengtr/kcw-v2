"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  addTIMatch,
  deleteTIMatch,
} from "@/app/(root)/(purchasing)/purchasing/ti/match-actions";

type Props = {
  tiLineUuid?: string;
  skuUuid: string;
  supplierUuid: string;
  locationUuid?: string;
  tiLineUnitCost: number;
  readOnly?: boolean;
  onChanged?: () => void;
};

type VOutstanding = {
  dn_line_uuid: string;
  dn_uuid: string;
  dn_number: string | null;
  dn_date: string; // yyyy-mm-dd
  location_uuid: string;
  supplier_uuid: string;
  sku_uuid: string;
  qty_received: number;
  qty_invoiced: number;
  qty_outstanding: number;
  status: "DRAFT" | "POSTED" | "VOID";
};

type AllocRow = {
  match_uuid: string;
  dn_line_uuid: string;
  dn_uuid: string;
  dn_number: string | null;
  dn_date: string;
  qty_matched: number;
  unit_cost_at_match: number;
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default function MatchDNDrawer({
  tiLineUuid,
  skuUuid,
  supplierUuid,
  locationUuid,
  tiLineUnitCost,
  readOnly,
  onChanged,
}: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [open, setOpen] = React.useState(false);

  // filters (strings to keep Input happy)
  const [q, setQ] = React.useState<string>("");
  const [from, setFrom] = React.useState<string>("");
  const [to, setTo] = React.useState<string>("");

  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<VOutstanding[]>([]);
  const [allocs, setAllocs] = React.useState<AllocRow[]>([]);
  const [qtyByDnLine, setQtyByDnLine] = React.useState<Record<string, string>>(
    {}
  ); // input values as strings

  const canEdit = !readOnly;

  // load when opened / filters change
  React.useEffect(() => {
    if (!open) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q, from, to, supplierUuid, skuUuid, locationUuid]);

  async function loadData() {
    setLoading(true);

    // list outstanding DN lines for this supplier + sku (+ location, date, q)
    let dnReq = supabase
      .from("v_dn_outstanding_ext")
      .select("*")
      .eq("supplier_uuid", supplierUuid)
      .eq("sku_uuid", skuUuid)
      .gt("qty_outstanding", 0)
      .order("dn_date", { ascending: true });

    if (locationUuid) dnReq = dnReq.eq("location_uuid", locationUuid);
    if (from) dnReq = dnReq.gte("dn_date", from);
    if (to) dnReq = dnReq.lte("dn_date", to);
    if (q.trim()) {
      const like = `%${q.replace(/[%_]/g, " ").trim()}%`;
      dnReq = dnReq.ilike("dn_number", like);
    }

    const [{ data: dnRows }, { data: allocRows }] = await Promise.all([
      dnReq,
      supabase
        .from("v_ti_line_alloc_detail")
        .select("*")
        .eq("ti_line_uuid", tiLineUuid)
        .order("dn_date", { ascending: true }),
    ]);

    setRows((dnRows ?? []) as VOutstanding[]);
    setAllocs(
      (allocRows ?? []).map((r) => ({
        match_uuid: r.match_uuid as string,
        dn_line_uuid: r.dn_line_uuid as string,
        dn_uuid: r.dn_uuid as string,
        dn_number: (r.dn_number as string) ?? null,
        dn_date: r.dn_date as string,
        qty_matched: Number(r.qty_matched),
        unit_cost_at_match: Number(r.unit_cost_at_match),
      }))
    );
    setLoading(false);
  }

  async function handleAllocate(dn_line_uuid: string) {
    if (!canEdit || !tiLineUuid) return;
    const qtyStr = qtyByDnLine[dn_line_uuid] ?? "";
    const qty = Number(qtyStr);
    if (!qty || qty <= 0) return;

    await addTIMatch({
      ti_line_uuid: tiLineUuid,
      dn_line_uuid,
      qty_matched: qty,
      unit_cost_at_match: tiLineUnitCost,
    });

    // reset input, refresh lists
    setQtyByDnLine((m) => ({ ...m, [dn_line_uuid]: "" }));
    await loadData();
    onChanged?.();
  }

  async function handleDelete(match_uuid: string) {
    if (!canEdit) return;
    await deleteTIMatch(match_uuid);
    await loadData();
    onChanged?.();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!canEdit}>
          Match DN
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[720px] sm:w-[720px]">
        <SheetHeader>
          <SheetTitle>Match DN Lines</SheetTitle>
        </SheetHeader>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search DN number"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 w-[240px]"
          />
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9"
          />
          <span>—</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9"
          />
          <Button
            variant="outline"
            onClick={() => {
              setQ("");
              setFrom("");
              setTo("");
            }}
          >
            Reset
          </Button>
        </div>

        {/* Outstanding list */}
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Outstanding DN lines</div>
          <div className="max-h-[300px] overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="h-10 text-left">
                  <th className="px-3">DN Date</th>
                  <th className="px-3">DN No.</th>
                  <th className="px-3 text-right">Received</th>
                  <th className="px-3 text-right">Invoiced</th>
                  <th className="px-3 text-right">Outstanding</th>
                  <th className="px-3 w-40">Allocate</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr className="h-14">
                    <td className="px-3 text-muted-foreground" colSpan={6}>
                      No outstanding lines
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const d = new Date(`${r.dn_date}T00:00:00Z`);
                  const val = qtyByDnLine[r.dn_line_uuid] ?? "";
                  return (
                    <tr key={r.dn_line_uuid} className="h-11 border-t">
                      <td className="px-3">{dateFmt.format(d)}</td>
                      <td className="px-3">{r.dn_number ?? "—"}</td>
                      <td className="px-3 text-right">
                        {r.qty_received.toLocaleString()}
                      </td>
                      <td className="px-3 text-right">
                        {r.qty_invoiced.toLocaleString()}
                      </td>
                      <td className="px-3 text-right font-medium">
                        {r.qty_outstanding.toLocaleString()}
                      </td>
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.0001"
                            value={val}
                            onChange={(e) =>
                              setQtyByDnLine((m) => ({
                                ...m,
                                [r.dn_line_uuid]: e.target.value,
                              }))
                            }
                            className="h-8 w-24"
                            disabled={!canEdit}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleAllocate(r.dn_line_uuid)}
                            disabled={!canEdit || !val}
                          >
                            Allocate
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Current allocations */}
        <div className="mt-6">
          <div className="text-sm font-medium mb-2">Current allocations</div>
          <div className="max-h-[220px] overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="h-10 text-left">
                  <th className="px-3">DN Date</th>
                  <th className="px-3">DN No.</th>
                  <th className="px-3 text-right">Qty Matched</th>
                  <th className="px-3 text-right">Unit Cost</th>
                  <th className="px-3"></th>
                </tr>
              </thead>
              <tbody>
                {allocs.length === 0 ? (
                  <tr className="h-14">
                    <td className="px-3 text-muted-foreground" colSpan={5}>
                      No allocations
                    </td>
                  </tr>
                ) : (
                  allocs.map((a) => {
                    const d = new Date(`${a.dn_date}T00:00:00Z`);
                    return (
                      <tr key={a.match_uuid} className="h-11 border-t">
                        <td className="px-3">{dateFmt.format(d)}</td>
                        <td className="px-3">{a.dn_number ?? "—"}</td>
                        <td className="px-3 text-right">
                          {a.qty_matched.toLocaleString()}
                        </td>
                        <td className="px-3 text-right">
                          {a.unit_cost_at_match.toLocaleString()}
                        </td>
                        <td className="px-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleDelete(a.match_uuid)}
                            disabled={!canEdit}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
