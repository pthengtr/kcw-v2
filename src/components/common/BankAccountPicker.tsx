"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

export type BankAccountType = "CHECKING" | "SAVINGS" | "OTHER";

export type PartyBankLike = {
  bank_info_uuid: string;
  bank_name: string; // stored label, e.g. "ไทยพาณิชย์"
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string | undefined;
  account_type: BankAccountType;
  is_default: boolean;
};

export type PartyWithBanksLike = {
  party_uuid: string;
  banks: PartyBankLike[];
};

type CreateBankInput = {
  bank_name: string; // we'll pass the label from the catalog
  bank_account_name: string;
  bank_account_number: string;
  bank_branch?: string | undefined;
  account_type?: BankAccountType;
  is_default?: boolean;
};

type Props = {
  party?: PartyWithBanksLike | null;
  value?: string | null;
  onChange?: (bank: PartyBankLike | undefined) => void;
  onCreateBank?: (
    party_uuid: string,
    input: CreateBankInput
  ) => Promise<PartyBankLike | void>;
  /** Optional hook for reloading banks from server after creation */
  onReloadBanks?: (party_uuid: string) => Promise<PartyBankLike[]>;
  /** If provided + submitParentOnCreate=true, call requestSubmit() on this form after creation */
  parentFormId?: string;
  submitParentOnCreate?: boolean;
  autoSelectNew?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
};

/** Canonical Thai banks catalog (value = code, label = display name) */
const thaiBanks = [
  { value: "scb", label: "ไทยพาณิชย์" },
  { value: "ktb", label: "กรุงไทย" },
  { value: "bbl", label: "กรุงเทพ" },
  { value: "kbank", label: "กสิกรไทย" },
  { value: "krungsri", label: "กรุงศรีอยุธยา" },
  { value: "tmb", label: "ทหารไทย" },
  { value: "uob", label: "UOB Bank (Thailand)" },
  { value: "gsb", label: "ออมสิน" },
  { value: "citi", label: "ซิตี้แบงก์" },
  { value: "cimb", label: "ซีไอเอ็มบี ไทย" },
  { value: "icbc", label: "ไอซีบีซีไทย" },
  { value: "afb", label: "อาคารสงเคราะห์" },
  { value: "kcc", label: "เกียรตินาคิน" },
  { value: "lh", label: "แลนด์ แอนด์ เฮาส์" },
  { value: "tisco", label: "ทิสโก้" },
  { value: "baac", label: "ธ.ก.ส." },
] as const;

function bankLabel(b: PartyBankLike) {
  const branch = b.bank_branch ? ` • สาขา ${b.bank_branch}` : "";
  const def = b.is_default ? " • Default" : "";
  return `${b.bank_name} — ${b.bank_account_name} (${b.bank_account_number})${branch} • ${b.account_type}${def}`;
}

export default function BankAccountPicker({
  party,
  value,
  onChange,
  onCreateBank,
  onReloadBanks,
  parentFormId,
  submitParentOnCreate = false,
  autoSelectNew = false,
  disabled,
  error,
  className,
  placeholder = "เลือกบัญชีธนาคาร…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [bankCode, setBankCode] = useState<string>(""); // selected code from catalog

  // Local mirror so the list updates immediately after "create"
  const [banks, setBanks] = useState<PartyBankLike[]>(party?.banks ?? []);
  useEffect(() => {
    setBanks(party?.banks ?? []);
  }, [party?.party_uuid, party?.banks]);

  const selected = useMemo(
    () => banks.find((b) => b.bank_info_uuid === value) ?? null,
    [banks, value]
  );

  const filtered = useMemo(() => {
    if (!banks) return [];
    const norm = q.trim().toLowerCase();
    if (!norm) return banks;
    return banks.filter((b) =>
      [
        b.bank_name,
        b.bank_account_name,
        b.bank_account_number,
        b.bank_branch || "",
        b.account_type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(norm)
    );
  }, [banks, q]);

  function submitParentIfNeeded() {
    if (submitParentOnCreate && parentFormId) {
      const el = document.getElementById(
        parentFormId
      ) as HTMLFormElement | null;
      el?.requestSubmit?.();
    }
  }

  return (
    <div
      className={className}
      onKeyDownCapture={(e) => {
        if (e.key === "Enter") e.stopPropagation();
      }}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || !party}
            className="w-full justify-between"
          >
            <span className="truncate text-left">
              {selected ? bankLabel(selected) : placeholder}
            </span>
            <div className="ml-2 flex items-center gap-1">
              {selected && !disabled && (
                <X
                  className="h-4 w-4 opacity-70 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange?.(undefined);
                  }}
                />
              )}
              <ChevronsUpDown className="ml-1 h-4 w-4 opacity-70" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[520px]">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="พิมพ์เพื่อค้นหา…"
              value={q}
              onValueChange={setQ}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            />
            <CommandList>
              {!party || banks.length === 0 ? (
                <CommandEmpty>ยังไม่มีบัญชีธนาคาร</CommandEmpty>
              ) : null}

              <CommandGroup heading="บัญชีที่มีอยู่">
                {filtered.map((b) => {
                  const isSel = selected?.bank_info_uuid === b.bank_info_uuid;
                  return (
                    <CommandItem
                      key={b.bank_info_uuid}
                      value={b.bank_info_uuid}
                      onSelect={() => {
                        onChange?.(b);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {b.bank_name} — {b.bank_account_name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {b.bank_account_number}
                          {b.bank_branch
                            ? ` • สาขา ${b.bank_branch}`
                            : ""} • {b.account_type}
                          {b.is_default ? " • Default" : ""}
                        </div>
                      </div>
                      <Check
                        className={`ml-2 h-4 w-4 ${
                          isSel ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              <div className="border-t my-1" />

              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setCreateOpen(true);
                    setOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มบัญชีใหม่…
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มบัญชีธนาคาร</DialogTitle>
          </DialogHeader>

          <form
            id="create-bank-form"
            onSubmit={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!party || !onCreateBank || creating) return;
              setCreating(true);
              try {
                const fd = new FormData(e.currentTarget);
                const selectedBank = thaiBanks.find(
                  (b) => b.value === bankCode
                );
                if (!selectedBank) {
                  alert("กรุณาเลือกธนาคารจากรายการ");
                  return;
                }
                const payload: CreateBankInput = {
                  bank_name: selectedBank.label, // store label in bank_name (schema uses text)
                  bank_account_name: (
                    (fd.get("bank_account_name") as string) || ""
                  ).trim(),
                  bank_account_number: (
                    (fd.get("bank_account_number") as string) || ""
                  ).trim(),
                  bank_branch:
                    ((fd.get("bank_branch") as string) || "").trim() ||
                    undefined,
                  account_type:
                    (fd.get("account_type") as BankAccountType) || "OTHER",
                  is_default: fd.get("is_default") === "on",
                };
                const created = await onCreateBank(party.party_uuid, payload);

                // Immediate UI update:
                if (created) {
                  setBanks((prev) => {
                    const exists = prev.some(
                      (x) => x.bank_info_uuid === created.bank_info_uuid
                    );
                    return exists ? prev : [created as PartyBankLike, ...prev];
                  });
                  if (autoSelectNew) onChange?.(created as PartyBankLike);
                } else if (onReloadBanks) {
                  // If create didn't return the row, reload from server
                  const fresh = await onReloadBanks(party.party_uuid);
                  setBanks(fresh);
                }

                setCreateOpen(false);
                (e.target as HTMLFormElement).reset();
                setBankCode("");

                submitParentIfNeeded();
              } finally {
                setCreating(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.stopPropagation();
            }}
          >
            {/* Bank (from catalog) */}
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>ธนาคาร</Label>
                <Select value={bankCode} onValueChange={setBankCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกธนาคาร" />
                  </SelectTrigger>
                  <SelectContent>
                    {thaiBanks.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>ชื่อบัญชี</Label>
                <Input name="bank_account_name" required />
              </div>

              <div>
                <Label>เลขที่บัญชี</Label>
                <Input name="bank_account_number" required />
              </div>

              <div>
                <Label>สาขา</Label>
                <Input name="bank_branch" />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3 items-end mt-2">
              {/* <div>
                <Label>ประเภทบัญชี</Label>
                <Select
                  defaultValue="OTHER"
                  onValueChange={(v) => {
                    const hidden = document.getElementById(
                      "account-type-hidden"
                    ) as HTMLInputElement;
                    if (hidden) hidden.value = v;
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHECKING">CHECKING</SelectItem>
                    <SelectItem value="SAVINGS">SAVINGS</SelectItem>
                    <SelectItem value="OTHER">OTHER</SelectItem>
                  </SelectContent>
                </Select>
                <input
                  id="account-type-hidden"
                  name="account_type"
                  type="hidden"
                  defaultValue="OTHER"
                />
              </div> */}

              <label className="inline-flex items-center gap-2 mt-1">
                <input type="checkbox" name="is_default" className="h-4 w-4" />
                ตั้งเป็นค่าเริ่มต้น
              </label>
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              form="create-bank-form"
              disabled={!party || !onCreateBank || creating}
            >
              {creating ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
