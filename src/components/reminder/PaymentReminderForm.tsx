"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import PartySelect from "../common/PartySelect";
import type { PartyOption, PartyKind } from "@/lib/types/models";
import { cn } from "@/lib/utils";
import type { PostgrestError } from "@supabase/supabase-js";

// ----- Zod schema (UI/form layer: Dates in, strings out at submit)
const FormSchema = z.object({
  note_id: z.string().min(1, "กรุณากรอกเลขที่เอกสาร"),
  bill_count: z.coerce.number().int().min(1, "อย่างน้อย 1 ใบ"),
  total_amount: z.coerce.number().nonnegative("ต้องเป็นจำนวนบวก"),
  discount: z.coerce.number().min(0, "ต้องเป็นจำนวนบวกหรือศูนย์"),
  remark: z.string().optional().nullable(),
  proof_of_payment: z.boolean().optional(),

  start_date: z.date(),
  end_date: z.date(),
  due_date: z.date(),
  payment_date: z.date().nullable().optional(),
  kbiz_datetime: z.date().nullable().optional(),

  party_uuid: z.string().uuid("เลือกคู่ค้า").optional(), // derived from PartySelect
  bank_info_uuid: z.string().uuid("เลือกบัญชีธนาคาร").optional(), // from bank picker
});

export type ReminderFormValues = z.infer<typeof FormSchema>;

export type PaymentReminderRow = {
  created_at: string;
  note_id: string;
  bill_count: number;
  start_date: string;
  end_date: string;
  total_amount: number;
  user_id: string;
  last_modified: string;
  due_date: string;
  payment_date: string | null;
  kbiz_datetime: string | null;
  discount: number;
  remark: string | null;
  proof_of_payment: boolean | null;
  bank_info_uuid: string;
  party_uuid: string;
  reminder_uuid: string;
};

type Props = {
  mode: "create" | "edit";
  currentUserId: string; // session user id to write into user_id
  defaultPartyKind?: PartyKind | "ANY"; // filters PartySelect
  value?: PaymentReminderRow; // when editing
  className?: string;
  onSaved?: (row: PaymentReminderRow) => void;
};

const iso = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString() : null;

type BankOption = {
  bank_info_uuid: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  is_default: boolean;
};

export default function PaymentReminderForm({
  mode,
  currentUserId,
  defaultPartyKind = "SUPPLIER",
  value,
  className,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [party, setParty] = useState<PartyOption | undefined>(undefined);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankInfoUuid, setBankInfoUuid] = useState<string | undefined>(
    undefined
  );
  const [submitting, setSubmitting] = useState(false);
  const isEdit = mode === "edit";

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: async () => {
      if (isEdit && value) {
        return {
          note_id: value.note_id,
          bill_count: value.bill_count,
          total_amount: value.total_amount,
          discount: value.discount,
          remark: value.remark ?? "",
          proof_of_payment: !!value.proof_of_payment,
          start_date: new Date(value.start_date),
          end_date: new Date(value.end_date),
          due_date: new Date(value.due_date),
          payment_date: value.payment_date
            ? new Date(value.payment_date)
            : null,
          kbiz_datetime: value.kbiz_datetime
            ? new Date(value.kbiz_datetime)
            : null,
          party_uuid: value.party_uuid,
          bank_info_uuid: value.bank_info_uuid,
        } satisfies ReminderFormValues;
      }
      const now = new Date();
      return {
        note_id: "",
        bill_count: 1,
        total_amount: 0,
        discount: 0,
        remark: "",
        proof_of_payment: false,
        start_date: now,
        end_date: now,
        due_date: now,
        payment_date: null,
        kbiz_datetime: null,
        party_uuid: undefined,
        bank_info_uuid: undefined,
      } satisfies ReminderFormValues;
    },
  });

  // Hydrate Party & Banks when editing
  useEffect(() => {
    (async () => {
      if (!isEdit || !value) return;

      type PartyRow = PartyOption; // identical after aliasing

      const { data: p, error } = await supabase
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
        .eq("party_uuid", value.party_uuid)
        .maybeSingle<PartyRow>();

      if (error) throw error;
      if (p) setParty(p); // ✅ no casts, fully typed

      // banks for this party
      await refreshBanks(value.party_uuid);
      setBankInfoUuid(value.bank_info_uuid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, value?.party_uuid, value?.bank_info_uuid]);

  const refreshBanks = useCallback(
    async (party_uuid?: string) => {
      if (!party_uuid) {
        setBanks([]);
        return;
      }
      const { data, error } = await supabase
        .from("party_bank_info")
        .select(
          "bank_info_uuid, bank_name, bank_account_name, bank_account_number, is_default"
        )
        .eq("party_uuid", party_uuid)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (!error && data) {
        setBanks(data as BankOption[]);
        // pick default if none chosen
        const current = form.getValues("bank_info_uuid");
        if (!current && data.length) {
          const preferred = data.find((b) => b.is_default) ?? data[0];
          setBankInfoUuid(preferred.bank_info_uuid);
          form.setValue("bank_info_uuid", preferred.bank_info_uuid, {
            shouldValidate: true,
          });
        }
      }
    },
    [supabase, form]
  );

  // When party changes from PartySelect → update form & load banks
  useEffect(() => {
    const pid = party?.party_uuid;
    form.setValue("party_uuid", pid, { shouldValidate: true });
    setBankInfoUuid(undefined);
    refreshBanks(pid);
  }, [party, form, refreshBanks]);

  const onSubmit = form.handleSubmit(async (v) => {
    if (!v.party_uuid) {
      form.setError("party_uuid", { message: "กรุณาเลือกคู่ค้า" });
      return;
    }
    if (!v.bank_info_uuid) {
      form.setError("bank_info_uuid", { message: "กรุณาเลือกบัญชีธนาคาร" });
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();

      if (isEdit && value) {
        const update = {
          note_id: v.note_id.trim(),
          bill_count: v.bill_count,
          total_amount: v.total_amount,
          discount: v.discount,
          remark: v.remark ?? null,
          proof_of_payment: !!v.proof_of_payment,
          start_date: iso(v.start_date)!,
          end_date: iso(v.end_date)!,
          due_date: iso(v.due_date)!,
          payment_date: v.payment_date ? iso(v.payment_date) : null,
          kbiz_datetime: v.kbiz_datetime ? iso(v.kbiz_datetime) : null,
          bank_info_uuid: v.bank_info_uuid,
          party_uuid: v.party_uuid,
          last_modified: nowIso,
          user_id: currentUserId, // keep writer audit fresh on edits too
        };

        const { data, error } = await supabase
          .from("payment_reminder")
          .update(update)
          .eq("reminder_uuid", value.reminder_uuid)
          .select()
          .single<PaymentReminderRow>();

        if (error) throw error;
        onSaved?.(data!);
      } else {
        const insert = {
          created_at: nowIso,
          last_modified: nowIso,
          user_id: currentUserId,
          note_id: v.note_id.trim(),
          bill_count: v.bill_count,
          start_date: iso(v.start_date)!,
          end_date: iso(v.end_date)!,
          total_amount: v.total_amount,
          due_date: iso(v.due_date)!,
          payment_date: v.payment_date ? iso(v.payment_date) : null,
          kbiz_datetime: v.kbiz_datetime ? iso(v.kbiz_datetime) : null,
          discount: v.discount,
          remark: v.remark ?? null,
          proof_of_payment: !!v.proof_of_payment,
          bank_info_uuid: v.bank_info_uuid!,
          party_uuid: v.party_uuid!,
        };

        const { data, error } = await supabase
          .from("payment_reminder")
          .insert(insert)
          .select()
          .single<PaymentReminderRow>();

        if (error) throw error;
        onSaved?.(data!);
      }
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        form.setError("note_id", {
          message: "เลขที่เอกสารซ้ำกับคู่ค้ารายนี้ (ต้องไม่ซ้ำ)",
        });
      } else {
        console.error("save failed:", err);
        alert(errorMessage(err) || "บันทึกล้มเหลว");
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
      {/* Party */}
      <div className="space-y-2">
        <Label>คู่ค้า</Label>
        <PartySelect
          selectedParty={party}
          setSelectedParty={setParty}
          kind={defaultPartyKind}
          placeholder="เลือกคู่ค้า…"
        />
        {form.formState.errors.party_uuid && (
          <p className="text-sm text-red-600">
            {form.formState.errors.party_uuid.message}
          </p>
        )}
      </div>

      {/* Bank account (filtered by party) */}
      <div className="space-y-2">
        <Label>บัญชีธนาคาร</Label>
        <div className="flex gap-2">
          <select
            className="w-full border rounded-md px-3 py-2"
            value={bankInfoUuid || ""}
            onChange={(e) => {
              setBankInfoUuid(e.target.value || undefined);
              form.setValue("bank_info_uuid", e.target.value || undefined, {
                shouldValidate: true,
              });
            }}
            disabled={!party}
          >
            <option value="">— เลือกบัญชี —</option>
            {banks.map((b) => (
              <option key={b.bank_info_uuid} value={b.bank_info_uuid}>
                {b.bank_name} • {b.bank_account_name} • {b.bank_account_number}
                {b.is_default ? " (ค่าเริ่มต้น)" : ""}
              </option>
            ))}
          </select>
          {/* You can add a “New bank” button here to open your BankAccountPicker flow */}
        </div>
        {form.formState.errors.bank_info_uuid && (
          <p className="text-sm text-red-600">
            {form.formState.errors.bank_info_uuid.message}
          </p>
        )}
      </div>

      {/* Note ID */}
      <div className="space-y-2">
        <Label>เลขที่เอกสาร (ไม่ซ้ำในคู่ค้าเดียวกัน)</Label>
        <Input {...form.register("note_id")} placeholder="เช่น INV-2025-001" />
        {form.formState.errors.note_id && (
          <p className="text-sm text-red-600">
            {form.formState.errors.note_id.message}
          </p>
        )}
      </div>

      {/* Counts & Amounts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label>จำนวนใบ</Label>
          <Input
            type="number"
            min={1}
            {...form.register("bill_count", { valueAsNumber: true })}
          />
        </div>
        <div>
          <Label>มูลค่ารวม</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            {...form.register("total_amount", { valueAsNumber: true })}
          />
        </div>
        <div>
          <Label>ส่วนลด</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            {...form.register("discount", { valueAsNumber: true })}
          />
        </div>
        <div className="flex items-end gap-2">
          <Checkbox
            checked={!!form.watch("proof_of_payment")}
            onCheckedChange={(v) => form.setValue("proof_of_payment", !!v)}
            id="pop"
          />
          <Label htmlFor="pop">มีหลักฐานการโอน</Label>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>เริ่มต้น</Label>
          <Input
            type="datetime-local"
            value={dateInputValue(form.watch("start_date"))}
            onChange={(e) =>
              form.setValue("start_date", fromInput(e.target.value), {
                shouldValidate: true,
              })
            }
          />
        </div>
        <div>
          <Label>สิ้นสุด</Label>
          <Input
            type="datetime-local"
            value={dateInputValue(form.watch("end_date"))}
            onChange={(e) =>
              form.setValue("end_date", fromInput(e.target.value), {
                shouldValidate: true,
              })
            }
          />
        </div>
        <div>
          <Label>กำหนดชำระ</Label>
          <Input
            type="datetime-local"
            value={dateInputValue(form.watch("due_date"))}
            onChange={(e) =>
              form.setValue("due_date", fromInput(e.target.value), {
                shouldValidate: true,
              })
            }
          />
        </div>
      </div>

      {/* Optional dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>วันโอนจริง (ถ้ามี)</Label>
          <Input
            type="datetime-local"
            value={dateInputValue(form.watch("payment_date"))}
            onChange={(e) =>
              form.setValue("payment_date", nullableFromInput(e.target.value), {
                shouldValidate: true,
              })
            }
          />
        </div>
        <div>
          <Label>วันเข้า KBIZ (ถ้ามี)</Label>
          <Input
            type="datetime-local"
            value={dateInputValue(form.watch("kbiz_datetime"))}
            onChange={(e) =>
              form.setValue(
                "kbiz_datetime",
                nullableFromInput(e.target.value),
                { shouldValidate: true }
              )
            }
          />
        </div>
      </div>

      {/* Remark */}
      <div className="space-y-2">
        <Label>หมายเหตุ</Label>
        <Textarea
          rows={3}
          {...form.register("remark")}
          placeholder="ระบุหมายเหตุ (ถ้ามี)"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {isEdit ? "บันทึกการแก้ไข" : "สร้างรายการ"}
        </Button>
      </div>
    </form>
  );
}

/* ---------- date helpers ---------- */
function dateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  // to "YYYY-MM-DDTHH:MM"
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}
function fromInput(v: string): Date {
  return v ? new Date(v) : new Date();
}
function nullableFromInput(v: string): Date | null {
  return v ? new Date(v) : null;
}

function isPostgrestError(e: unknown): e is PostgrestError {
  return !!e && typeof e === "object" && "message" in e;
}

function isUniqueViolation(e: unknown): boolean {
  if (!isPostgrestError(e)) return false;
  return (
    e.code === "23505" ||
    /duplicate key|unique constraint|already exists/i.test(e.message) ||
    /unique/i.test(e.details ?? "")
  );
}

function errorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (isPostgrestError(e)) return e.message || e.details || "Unexpected error";
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unexpected error";
  }
}
