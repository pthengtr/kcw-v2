"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SKUOption = {
  sku_uuid: string;
  sku_code: string | null;
  product_name: string;
  uom_code: string;
  is_active: boolean; // from sku.is_active
  barcodes: { code: string; is_primary: boolean }[];
  qty_on_hand?: number; // optional enrichment when locationUuid provided
};

type Props = {
  selectedSku: SKUOption | undefined;
  setSelectedSku: (sku: SKUOption | undefined) => void;
  locationUuid?: string; // show qty at this location (optional)
  showInactive?: boolean; // default true (allow all)
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  limit?: number;
  error?: string;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function highlightText(text: string, q: string) {
  const norm = (q || "").replace(/[%_]/g, " ").trim();
  if (!norm) return text;
  const tokens = Array.from(new Set(norm.split(/\s+/).filter(Boolean)));
  if (tokens.length === 0) return text;
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <mark key={idx} className="bg-yellow-200/60 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={idx}>{part}</span>
    )
  );
}

export default function SKUSelect({
  selectedSku,
  setSelectedSku,
  locationUuid,
  showInactive = true,
  placeholder = "ค้นหาบาร์โค้ด / SKU / ชื่อสินค้า…",
  disabled,
  className,
  limit = 30,
  error,
}: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<SKUOption[]>([]);
  // at top of component
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = React.useRef(0);

  const hydrateStockFor = React.useCallback(
    async (items: SKUOption[], loc?: string): Promise<SKUOption[]> => {
      if (!loc || items.length === 0) return items;

      const ids = items.map((x) => x.sku_uuid);
      const CHUNK = 200; // safe chunk size for .in()

      type StockRow = {
        sku_uuid: string;
        location_uuid: string;
        qty_on_hand: number | string | null;
      };

      const results: StockRow[] = [];

      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("stock_balance")
          .select("sku_uuid, location_uuid, qty_on_hand")
          .eq("location_uuid", loc)
          .in("sku_uuid", chunk);

        if (!error && data) {
          results.push(...(data as StockRow[]));
        }
        // You could optionally break on error, but swallowing keeps UI responsive.
      }

      const qtyBySku = new Map<string, number>(
        results.map((s) => [s.sku_uuid, Number(s.qty_on_hand ?? 0)])
      );

      return items.map((x) => ({
        ...x,
        qty_on_hand: qtyBySku.get(x.sku_uuid) ?? 0,
      }));
    },
    [supabase]
  );

  // ---------- helpers & row types (no `any`) ----------
  type OneOrMany<T> = T | T[];

  type ProductRow = { product_name: string | null };

  type SkuBase = {
    sku_uuid: string;
    sku_code: string | null;
    uom_code: string;
    is_active: boolean;
    product: OneOrMany<ProductRow> | null;
    barcodes?: { barcode: string; is_primary: boolean | null }[] | null;
  };

  type BcExactRow = {
    barcode: string;
    is_primary: boolean | null;
    // exact path does not need barcodes on sku
    sku: OneOrMany<Omit<SkuBase, "barcodes">> | null;
  };

  type SkuFuzzyRow = Omit<SkuBase, "product"> & {
    product: OneOrMany<ProductRow> | null;
    barcodes: { barcode: string; is_primary: boolean | null }[] | null;
  };

  type BcFuzzyRow = {
    barcode: string;
    is_primary: boolean | null;
    sku: OneOrMany<SkuFuzzyRow> | null;
  };

  const first = React.useCallback(function <T>(
    v: OneOrMany<T> | null | undefined
  ): T | undefined {
    return Array.isArray(v) ? v[0] : v ?? undefined;
  },
  []);

  const toOptionFromSkuNode = React.useCallback(
    function (s: SkuBase): SKUOption {
      const pname = first(s.product)?.product_name ?? "";
      const codes =
        (s.barcodes ?? []).map((b) => ({
          code: b.barcode,
          is_primary: !!b.is_primary,
        })) ?? [];
      return {
        sku_uuid: s.sku_uuid,
        sku_code: s.sku_code ?? null,
        product_name: pname,
        uom_code: s.uom_code,
        is_active: !!s.is_active,
        barcodes: codes,
      };
    },
    [first]
  );

  // ---------- fetchOptions (stable, typed, race-safe) ----------
  const fetchOptions = React.useCallback(
    async (query: string) => {
      const rid = ++requestIdRef.current;
      setLoading(true);
      const trimmed = (query ?? "").trim();

      try {
        // 1) Fast path: exact barcode (scanner-friendly)
        if (trimmed) {
          const { data: bcRows, error: bcErr } = await supabase
            .from("barcode")
            .select(
              `
            barcode, is_primary,
            sku:sku!inner(
              sku_uuid, sku_code, uom_code, is_active,
              product:product!inner( product_name )
            )
          `
            )
            .eq("barcode", trimmed)
            .limit(limit);

          if (!bcErr && bcRows && bcRows.length > 0) {
            const rows = bcRows as BcExactRow[];
            const dedup = new Map<string, SKUOption>();

            for (const r of rows) {
              const s = first(r.sku);
              if (!s) continue;

              const k = s.sku_uuid;
              const barcodeEntry = {
                code: r.barcode,
                is_primary: !!r.is_primary,
              };

              const existing = dedup.get(k);
              if (existing) {
                existing.barcodes.push(barcodeEntry);
              } else {
                dedup.set(k, {
                  sku_uuid: s.sku_uuid,
                  sku_code: s.sku_code ?? null,
                  product_name: first(s.product)?.product_name ?? "",
                  uom_code: s.uom_code,
                  is_active: !!s.is_active,
                  barcodes: [barcodeEntry],
                });
              }
            }

            let list = Array.from(dedup.values());
            if (!showInactive) list = list.filter((x) => x.is_active);
            if (locationUuid && list.length > 0) {
              list = await hydrateStockFor(list, locationUuid);
            }

            if (rid === requestIdRef.current) {
              setOptions(list.slice(0, limit));
            }
            return;
          }
        }

        // 2) Fuzzy search (sku_code / product_name / barcode)
        const like = `%${(trimmed || "").replace(/[%_]/g, " ").trim()}%`;

        // 2a) sku + product
        let skuReq = supabase
          .from("sku")
          .select(
            `
          sku_uuid, sku_code, uom_code, is_active,
          product:product( product_name ),
          barcodes:barcode( barcode, is_primary )
        `
          )
          .order("sku_code", { ascending: true })
          .limit(limit);

        if (!showInactive) skuReq = skuReq.eq("is_active", true);
        if (trimmed) {
          skuReq = skuReq.or(
            [
              `sku_code.ilike.${like}`,
              `product.product_name.ilike.${like}`,
            ].join(",")
          );
        }

        const { data: skuRows } = await skuReq;
        const skuList = (skuRows ?? []) as SkuFuzzyRow[];

        // 2b) barcode ilike -> join sku
        let bcReq = supabase
          .from("barcode")
          .select(
            `
          barcode, is_primary,
          sku:sku!inner(
            sku_uuid, sku_code, uom_code, is_active,
            product:product( product_name ),
            barcodes:barcode( barcode, is_primary )
          )
        `
          )
          .limit(limit);

        if (trimmed) bcReq = bcReq.ilike("barcode", like);
        const { data: bcLikeRows } = await bcReq;
        const bcList = (bcLikeRows ?? []) as BcFuzzyRow[];

        // Merge + dedupe by sku_uuid
        const bySku = new Map<string, SKUOption>();

        for (const r of skuList) {
          const opt = toOptionFromSkuNode(r);
          bySku.set(opt.sku_uuid, opt);
        }

        for (const r of bcList) {
          const s = first(r.sku);
          if (!s) continue;
          const key = s.sku_uuid;
          if (!bySku.has(key)) {
            bySku.set(key, toOptionFromSkuNode(s));
          }
        }

        let list = Array.from(bySku.values());
        if (!showInactive) list = list.filter((x) => x.is_active);
        if (locationUuid && list.length > 0) {
          list = await hydrateStockFor(list, locationUuid);
        }

        if (rid === requestIdRef.current) {
          setOptions(list.slice(0, limit));
        }
      } finally {
        if (rid === requestIdRef.current) setLoading(false);
      }
    },
    [
      supabase,
      limit,
      showInactive,
      locationUuid,
      first,
      hydrateStockFor,
      toOptionFromSkuNode,
    ]
  );

  React.useEffect(() => {
    // always clear any pending timer first
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!open) {
      // nothing to schedule if popover is closed
      return; // returns undefined => OK
    }

    // schedule the debounce
    timerRef.current = setTimeout(() => {
      void fetchOptions(q);
    }, 220);

    // proper cleanup that always returns void
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [q, open, locationUuid, showInactive, limit, fetchOptions]);

  React.useEffect(() => {
    if (open && options.length === 0) void fetchOptions("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function labelOf(s?: SKUOption | null) {
    if (!s) return "เลือกสินค้า…";
    const name = s.product_name || "(no name)";
    const sku = s.sku_code ? ` [${s.sku_code}]` : "";
    const uom = s.uom_code ? ` · ${s.uom_code}` : "";
    return `${name}${sku}${uom}${s.is_active ? "" : " · INACTIVE"}`;
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="truncate text-left">
              {selectedSku ? labelOf(selectedSku) : placeholder}
            </span>
            <div className="ml-2 flex items-center gap-1">
              {selectedSku && !disabled && (
                <X
                  className="h-4 w-4 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSku(undefined);
                  }}
                />
              )}
              <ChevronsUpDown className="ml-1 h-4 w-4 opacity-70" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[560px]">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="พิมพ์/สแกนเพื่อค้นหา…"
              value={q}
              onValueChange={setQ}
            />
            <CommandList>
              {loading && <CommandEmpty>กำลังค้นหา…</CommandEmpty>}
              {!loading && options.length === 0 && (
                <CommandEmpty>ไม่พบข้อมูล</CommandEmpty>
              )}
              <CommandGroup>
                {options.map((opt) => {
                  const isSelected = selectedSku?.sku_uuid === opt.sku_uuid;
                  const primaryBarcode =
                    opt.barcodes.find((b) => b.is_primary)?.code ??
                    opt.barcodes[0]?.code;

                  return (
                    <CommandItem
                      key={opt.sku_uuid}
                      value={opt.sku_uuid}
                      onSelect={() => {
                        setSelectedSku(opt);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {highlightText(
                            `${opt.product_name}${
                              opt.sku_code ? ` [${opt.sku_code}]` : ""
                            }${opt.uom_code ? ` · ${opt.uom_code}` : ""}`,
                            q
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {primaryBarcode ? (
                            <>บาร์โค้ด: {highlightText(primaryBarcode, q)}</>
                          ) : (
                            "—"
                          )}
                          {typeof opt.qty_on_hand === "number" && (
                            <>
                              {" "}
                              · คงเหลือ:{" "}
                              <span className="tabular-nums">
                                {opt.qty_on_hand}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
