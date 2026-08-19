"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { MAX_CUSTOM_BCODES } from "@/lib/bi/product-filters";
import type { BiProductSearchHit } from "@/lib/bi/product-sales-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  selected: BiProductSearchHit[];
  onChange: (products: BiProductSearchHit[]) => void;
  max?: number;
  disabled?: boolean;
};

export default function ProductBcodeMultiSelect({
  selected,
  onChange,
  max = MAX_CUSTOM_BCODES,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<BiProductSearchHit[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const atCap = selected.length >= max;

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void fetchOptions(q);
    }, 220);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  async function fetchOptions(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      setOptions([]);
      setLoading(false);
      return;
    }
    const rid = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: trimmed, limit: "20" });
      const res = await fetch(`/api/bi/products/search?${params.toString()}`);
      const json = (await res.json()) as { products?: BiProductSearchHit[] };
      if (rid !== requestIdRef.current) return;
      setOptions(res.ok ? (json.products ?? []) : []);
    } catch {
      if (rid === requestIdRef.current) setOptions([]);
    } finally {
      if (rid === requestIdRef.current) setLoading(false);
    }
  }

  function add(hit: BiProductSearchHit) {
    if (selected.some((p) => p.bcode === hit.bcode) || atCap) return;
    onChange([...selected, hit]);
    setQ("");
    setOpen(false);
  }

  function remove(bcode: string) {
    onChange(selected.filter((p) => p.bcode !== bcode));
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <li
              key={p.bcode}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs"
            >
              <span className="truncate font-medium text-slate-800">
                {p.bcode}
                {p.detail ? ` · ${p.detail}` : ""}
              </span>
              <button
                type="button"
                className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                aria-label={`ลบ ${p.bcode}`}
                onClick={() => remove(p.bcode)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="เพิ่มสินค้าในชุด"
            disabled={disabled || atCap}
            className="w-full justify-between"
          >
            <span className="truncate text-left text-muted-foreground">
              {atCap
                ? `ครบ ${max} รายการ`
                : "ค้นหาแล้วเพิ่มสินค้าในชุด…"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(560px,calc(100vw-2rem))] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="พิมพ์ BCODE หรือชื่อสินค้า…"
              value={q}
              onValueChange={setQ}
            />
            <CommandList>
              {loading ? <CommandEmpty>กำลังค้นหา…</CommandEmpty> : null}
              {!loading && options.length === 0 ? (
                <CommandEmpty>
                  {q.trim() ? "ไม่พบสินค้า" : "พิมพ์เพื่อค้นหา"}
                </CommandEmpty>
              ) : null}
              <CommandGroup>
                {options.map((opt) => {
                  const isSelected = selected.some((p) => p.bcode === opt.bcode);
                  const meta = [opt.brand, opt.model, opt.mcode]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <CommandItem
                      key={opt.bcode}
                      value={opt.bcode}
                      disabled={isSelected || atCap}
                      onSelect={() => add(opt)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {opt.bcode}
                          {opt.detail ? ` · ${opt.detail}` : ""}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {meta || "—"}
                          {` · คงเหลือ ${opt.on_hand_qty}`}
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
    </div>
  );
}
