"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { PartyKind, PartyOption } from "@/lib/types/models";

type Props = {
  selectedParty: PartyOption | undefined;
  setSelectedParty: (party: PartyOption | undefined) => void;
  kind?: PartyKind | "ANY";
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

export default function PartySelect({
  selectedParty,
  setSelectedParty,
  kind = "ANY",
  error,
  placeholder = "ค้นหาชื่อหรือโค้ดคู่ค้า…",
  disabled,
  className,
  limit = 20,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<PartyOption[]>([]);
  const timerRef = useRef<number | null>(null);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void fetchOptions(q), 250);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, kind, limit]);

  useEffect(() => {
    if (open && options.length === 0) void fetchOptions("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchOptions(query: string) {
    setLoading(true);
    const like = `%${(query || "").replace(/[%_]/g, " ").trim()}%`;

    let req = supabase
      .from("party")
      .select(
        `
        party_uuid,
        party_code,
        party_name,
        kind,
        tax_info:party_tax_info (
          tax_info_uuid, legal_name, tax_payer_id, address, created_at, updated_at
        ),
        banks:party_bank_info (
          bank_info_uuid, bank_name, bank_account_name, bank_account_number, bank_branch, account_type, is_default
        ),
        contacts:party_contact (
          contact_uuid, contact_name, role_title, email, phone, is_primary
        )
      `
      )
      .order("party_name", { ascending: true })
      .limit(limit);

    if (query?.trim()) {
      req = req.or(`party_name.ilike.${like},party_code.ilike.${like}`);
    }

    if (kind === "SUPPLIER") {
      req = req.in("kind", ["SUPPLIER", "BOTH"]);
    } else if (kind === "CUSTOMER") {
      req = req.in("kind", ["CUSTOMER", "BOTH"]);
    } else if (kind === "BOTH") {
      req = req.eq("kind", "BOTH");
    }

    const { data, error } = await req;
    if (!error && data) {
      setOptions(
        data.map((r) => ({
          party_uuid: r.party_uuid,
          party_code: r.party_code ?? null,
          party_name: r.party_name,
          kind: r.kind as PartyKind,
          tax_info: r.tax_info ?? [],
          banks: r.banks ?? [],
          contacts: r.contacts ?? [],
        }))
      );
    }
    setLoading(false);
  }

  function labelOf(p?: PartyOption | null) {
    if (!p) return "เลือกคู่ค้า…";
    const badge =
      p.kind === "SUPPLIER" ? "SUP" : p.kind === "CUSTOMER" ? "CUS" : "BOTH";
    return `${p.party_name}${
      p.party_code ? ` (${p.party_code})` : ""
    } · ${badge}`;
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
              {selectedParty
                ? labelOf(selectedParty)
                : placeholder || "เลือกคู่ค้า…"}
            </span>
            <div className="ml-2 flex items-center gap-1">
              {selectedParty && !disabled && (
                <X
                  className="h-4 w-4 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedParty(undefined);
                  }}
                />
              )}
              <ChevronsUpDown className="ml-1 h-4 w-4 opacity-70" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[480px]">
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
                    selectedParty?.party_uuid === opt.party_uuid;
                  const defaultBank =
                    opt.banks.find((b) => b.is_default) || opt.banks[0];

                  return (
                    <CommandItem
                      key={opt.party_uuid}
                      value={opt.party_uuid}
                      onSelect={() => {
                        setSelectedParty(opt);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {highlightText(opt.party_name, q)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {highlightText(opt.party_code || "—", q)} · {opt.kind}
                          {defaultBank ? (
                            <>
                              {" · "}
                              {highlightText(
                                `${defaultBank.bank_name} (${defaultBank.bank_account_number})`,
                                q
                              )}
                            </>
                          ) : null}
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
