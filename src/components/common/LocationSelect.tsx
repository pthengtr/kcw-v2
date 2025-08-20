// components/LocationSelect.tsx
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

export type LocationOption = {
  location_uuid: string;
  location_code: string;
  location_name: string;
  is_active: boolean;
};

type Props = {
  selectedLocation: LocationOption | undefined;
  setSelectedLocation: (loc: LocationOption | undefined) => void;
  showInactive?: boolean; // default false
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  limit?: number;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlight all case-insensitive occurrences of any token from q within text. */
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

export default function LocationSelect({
  selectedLocation,
  setSelectedLocation,
  showInactive = false,
  error,
  placeholder = "ค้นหาสาขาหรือโค้ด…",
  disabled,
  className,
  limit = 30,
}: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<LocationOption[]>([]);
  const timerRef = React.useRef<number | null>(null);

  // Debounce search
  React.useEffect(() => {
    if (!open) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void fetchOptions(q), 250);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, showInactive, limit]);

  // Initial load
  React.useEffect(() => {
    if (open && options.length === 0) void fetchOptions("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchOptions(query: string) {
    setLoading(true);
    const like = `%${(query || "").replace(/[%_]/g, " ").trim()}%`;

    let req = supabase
      .from("location")
      .select("location_uuid, location_code, location_name, is_active")
      .order("location_name", { ascending: true })
      .limit(limit);

    if (query?.trim()) {
      req = req.or(`location_name.ilike.${like},location_code.ilike.${like}`);
    }
    if (!showInactive) {
      req = req.eq("is_active", true);
    }

    const { data, error } = await req;
    if (!error && data) {
      setOptions(
        data.map((r) => ({
          location_uuid: r.location_uuid,
          location_code: r.location_code,
          location_name: r.location_name,
          is_active: r.is_active,
        }))
      );
    }
    setLoading(false);
  }

  function labelOf(l?: LocationOption | null) {
    if (!l) return "เลือกสาขา…";
    const badge = l.is_active ? "" : " · INACTIVE";
    return `${l.location_code} — ${l.location_name}${badge}`;
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
              {selectedLocation
                ? labelOf(selectedLocation)
                : placeholder || "เลือกสาขา…"}
            </span>
            <div className="ml-2 flex items-center gap-1">
              {selectedLocation && !disabled && (
                <X
                  className="h-4 w-4 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLocation(undefined);
                  }}
                />
              )}
              <ChevronsUpDown className="ml-1 h-4 w-4 opacity-70" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[460px]">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="พิมพ์เพื่อค้นหา…"
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
                  const isSelected =
                    selectedLocation?.location_uuid === opt.location_uuid;
                  return (
                    <CommandItem
                      key={opt.location_uuid}
                      value={opt.location_uuid}
                      onSelect={() => {
                        setSelectedLocation(opt);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {highlightText(
                            `${opt.location_code} — ${opt.location_name}`,
                            q
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {opt.is_active ? "Active" : "Inactive"}
                        </div>
                      </div>
                      <Check
                        className={`h-4 w-4 ${
                          isSelected ? "opacity-100" : "opacity-0"
                        }`}
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
