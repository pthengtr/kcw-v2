"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

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
  selected: BiProductSearchHit | undefined;
  onSelect: (product: BiProductSearchHit | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export default function ProductBcodeSelect({
  selected,
  onSelect,
  placeholder = "ค้นหา BCODE / ชื่อ / เบอร์แท้ / ยี่ห้อ…",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<BiProductSearchHit[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

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
      const json = (await res.json()) as {
        products?: BiProductSearchHit[];
        error?: string;
      };
      if (rid !== requestIdRef.current) return;
      if (!res.ok) {
        setOptions([]);
        return;
      }
      setOptions(json.products ?? []);
    } catch {
      if (rid === requestIdRef.current) setOptions([]);
    } finally {
      if (rid === requestIdRef.current) setLoading(false);
    }
  }

  const label = selected
    ? `${selected.bcode} · ${selected.detail || "ไม่มีชื่อ"}`
    : placeholder;

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="เลือกสินค้า"
            disabled={disabled}
            className="w-full justify-between"
          >
            <span className="truncate text-left">{label}</span>
            <span className="ml-2 flex items-center gap-1">
              {selected && !disabled ? (
                <X
                  className="h-4 w-4 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(undefined);
                  }}
                />
              ) : null}
              <ChevronsUpDown className="h-4 w-4 opacity-70" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
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
                  const isSelected = selected?.bcode === opt.bcode;
                  const meta = [opt.brand, opt.model, opt.mcode]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <CommandItem
                      key={opt.bcode}
                      value={opt.bcode}
                      onSelect={() => {
                        onSelect(opt);
                        setOpen(false);
                      }}
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
