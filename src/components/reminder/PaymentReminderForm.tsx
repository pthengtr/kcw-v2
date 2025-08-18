"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

import PartySelect from "../common/PartySelect";
import BankAccountPicker, {
  type PartyBankLike,
  type PartyWithBanksLike,
} from "../common/BankAccountPicker";
import { DatePickerInput } from "../common/DatePickerInput";

import type {
  PartyOption,
  PartyKind,
  PaymentReminderRow,
  PartyBankInfo,
} from "@/lib/types/models";
import type { PostgrestError } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

/* ---------------- constants & helpers ---------------- */
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const iso = (d: Date | null | undefined) =>
  d ? new Date(d).toISOString() : null;

/* ---------------- Zod schema ---------------- */
const FormSchema = z
  .object({
    note_id: z.string().min(1, "กรุณากรอกเลขที่เอกสาร"),
    bill_count: z.coerce.number().int().min(1, "อย่างน้อย 1 ใบ"),
    total_amount: z.coerce.number().nonnegative("ต้องเป็นจำนวนบวก"),
    discount: z.coerce.number().min(0, "ต้องเป็นจำนวนบวกหรือศูนย์"),
    remark: z.string().optional(),
    proof_of_payment: z.boolean().optional(),
    start_date: z.date(),
    end_date: z.date(),
    due_date: z.date(),
    payment_date: z.date().nullable().optional(),
    kbiz_datetime: z.date().nullable().optional(),
    party_uuid: z
      .string({ required_error: "เลือกคู่ค้า" })
      .uuid("เลือกคู่ค้า")
      .refine((v) => v !== NIL_UUID, "เลือกคู่ค้า"),
    bank_info_uuid: z
      .string({ required_error: "เลือกบัญชีธนาคาร" })
      .uuid("เลือกบัญชีธนาคาร")
      .refine((v) => v !== NIL_UUID, "เลือกบัญชีธนาคาร"),
  })
  .superRefine((v, ctx) => {
    if (v.end_date < v.start_date) {
      ctx.addIssue({
        path: ["end_date"],
        code: "custom",
        message: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น",
      });
    }
  });

export type ReminderFormValues = z.infer<typeof FormSchema>;

type Shared = {
  className?: string;
  currentUserId: string;
  defaultPartyKind?: PartyKind | "ANY";
  onSaved?: (row: PaymentReminderRow) => void;
};

type EditProps = Shared & { mode: "edit"; value: PaymentReminderRow };
type CreateProps = Shared & { mode: "create"; value?: never };
type PaymentReminderFormProps =
  | (EditProps & { open?: boolean })
  | (CreateProps & { open?: boolean });

function toPartyBankInfo(b: PartyBankLike): PartyBankInfo {
  return {
    bank_info_uuid: b.bank_info_uuid,
    bank_name: b.bank_name,
    bank_account_name: b.bank_account_name,
    bank_account_number: b.bank_account_number,
    bank_branch: b.bank_branch ?? null,
    account_type: b.account_type ?? "OTHER",
    is_default: !!b.is_default,
  };
}

export default function PaymentReminderForm({
  open,
  mode,
  currentUserId,
  defaultPartyKind = "SUPPLIER",
  value,
  className,
  onSaved,
}: PaymentReminderFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const isEdit = mode === "edit";

  const [party, setParty] = useState<PartyOption | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // guard to avoid party-change effect firing during edit hydration
  const hydratingRef = useRef(false);

  /* -------- form init -------- */
  const now = new Date();
  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
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
      party_uuid: NIL_UUID, // refined to be invalid until user chooses
      bank_info_uuid: NIL_UUID, // refined to be invalid until user chooses
    },
  });

  /* -------- helpers -------- */
  function mapRowToFormValues(r: PaymentReminderRow): ReminderFormValues {
    return {
      note_id: r.note_id,
      bill_count: r.bill_count,
      total_amount: r.total_amount,
      discount: r.discount,
      remark: r.remark ?? "",
      proof_of_payment: !!r.proof_of_payment,
      start_date: new Date(r.start_date),
      end_date: new Date(r.end_date),
      due_date: new Date(r.due_date),
      payment_date: r.payment_date ? new Date(r.payment_date) : null,
      kbiz_datetime: r.kbiz_datetime ? new Date(r.kbiz_datetime) : null,
      party_uuid: r.party_uuid,
      bank_info_uuid: r.bank_info_uuid,
    };
  }

  function createDefaults(): ReminderFormValues {
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
      party_uuid: NIL_UUID,
      bank_info_uuid: NIL_UUID,
    };
  }

  const loadParty = useCallback(
    async (party_uuid: string) => {
      type PartyRow = PartyOption;
      const { data, error } = await supabase
        .from("party")
        .select(
          `
          party_uuid,
          party_code,
          party_name,
          kind,
          tax_info:party_tax_info (tax_info_uuid, legal_name, tax_payer_id, address, created_at, updated_at),
          banks:party_bank_info (bank_info_uuid, bank_name, bank_account_name, bank_account_number, bank_branch, account_type, is_default),
          contacts:party_contact (contact_uuid, contact_name, role_title, email, phone, is_primary)
        `
        )
        .eq("party_uuid", party_uuid)
        .maybeSingle<PartyRow>();

      if (error) throw error;
      return data ?? undefined;
    },
    [supabase]
  );

  /* -------- when PartySelect changes (skip during hydration) -------- */
  useEffect(() => {
    if (hydratingRef.current) return;

    const pid = party?.party_uuid;
    const list = party?.banks ?? [];

    if (pid) {
      form.setValue("party_uuid", pid, { shouldValidate: true });
      const current = form.getValues("bank_info_uuid");
      const stillValid =
        current && list.some((b) => b.bank_info_uuid === current);

      if (!stillValid) {
        if (list.length) {
          const preferred = list.find((b) => b.is_default) ?? list[0];
          form.setValue("bank_info_uuid", preferred.bank_info_uuid, {
            shouldValidate: true,
          });
        } else {
          // no banks yet -> don’t validate now; user hasn’t picked anything
          form.setValue("bank_info_uuid", NIL_UUID, {
            shouldValidate: false,
            shouldDirty: false,
            shouldTouch: false,
          });
          form.clearErrors(["bank_info_uuid"]);
        }
      }
    } else {
      // party cleared -> set NILs silently and clear field errors
      form.setValue("party_uuid", NIL_UUID, {
        shouldValidate: false,
        shouldDirty: false,
        shouldTouch: false,
      });
      form.setValue("bank_info_uuid", NIL_UUID, {
        shouldValidate: false,
        shouldDirty: false,
        shouldTouch: false,
      });
      form.clearErrors(["party_uuid", "bank_info_uuid"]);
    }
  }, [party?.party_uuid, party?.banks, form]);

  /* -------- EDIT: reset + hydrate in sequence -------- */
  useEffect(() => {
    if (!isEdit || !value) return;
    let cancelled = false;

    (async () => {
      try {
        hydratingRef.current = true;

        // 1) reset all fields from the existing row
        const editVals = mapRowToFormValues(value);
        form.reset(editVals);

        // 2) load full party (with banks) and set PartySelect
        const p = await loadParty(value.party_uuid);
        if (cancelled) return;
        setParty(p);
      } catch (e) {
        console.error("[hydrate edit] failed", e);
      } finally {
        hydratingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isEdit,
    value?.reminder_uuid,
    value?.party_uuid,
    value?.bank_info_uuid,
    form,
    loadParty,
    value,
  ]);

  useEffect(() => {
    if (open && mode === "create") {
      hydratingRef.current = true; // block the party-effect below
      form.reset(createDefaults(), {
        keepErrors: false,
        keepDirty: false,
        keepTouched: false,
        keepIsSubmitted: false,
        keepSubmitCount: false,
      });
      setParty(undefined);
      form.clearErrors();

      // release on next tick so the effect doesn’t run during this cycle
      setTimeout(() => {
        hydratingRef.current = false;
      }, 0);
    }
  }, [open, mode, form]);

  /* -------- submit -------- */
  const onSubmit = form.handleSubmit(async (v) => {
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
          user_id: currentUserId,
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
          bank_info_uuid: v.bank_info_uuid,
          party_uuid: v.party_uuid,
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

  /* -------- render -------- */
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
        {/* Party */}
        <div className="space-y-2">
          <Label>คู่ค้า</Label>
          <PartySelect
            key={party?.party_uuid || "new"} // force re-render when hydrating
            selectedParty={party}
            setSelectedParty={setParty}
            kind={defaultPartyKind}
            placeholder="เลือกคู่ค้า…"
          />
          <FormMessage />
        </div>

        {/* Bank account */}
        <div className="space-y-2">
          <Label>บัญชีธนาคาร</Label>
          <BankAccountPicker
            party={
              party
                ? ({
                    party_uuid: party.party_uuid,
                    banks: party.banks,
                  } as PartyWithBanksLike)
                : null
            }
            value={form.watch("bank_info_uuid") || null}
            onChange={(b: PartyBankLike | undefined) => {
              form.setValue("bank_info_uuid", b?.bank_info_uuid ?? NIL_UUID, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
              });
            }}
            onCreateBank={async (party_uuid, input) => {
              const { data, error } = await supabase
                .from("party_bank_info")
                .insert({
                  party_uuid,
                  bank_name: input.bank_name,
                  bank_account_name: input.bank_account_name,
                  bank_account_number: input.bank_account_number,
                  bank_branch: input.bank_branch ?? null,
                  account_type: input.account_type ?? "OTHER",
                  is_default: !!input.is_default,
                })
                .select(
                  "bank_info_uuid, bank_name, bank_account_name, bank_account_number, bank_branch, account_type, is_default"
                )
                .single();

              if (error) {
                console.error("[create bank] failed", error);
                throw error;
              }

              form.setValue("bank_info_uuid", data!.bank_info_uuid, {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
              });

              setParty((prev) =>
                prev
                  ? {
                      ...prev,
                      banks: [
                        toPartyBankInfo({
                          bank_info_uuid: data!.bank_info_uuid,
                          bank_name: data!.bank_name,
                          bank_account_name: data!.bank_account_name,
                          bank_account_number: data!.bank_account_number,
                          bank_branch: data.bank_branch ?? undefined,
                          account_type: data.account_type ?? "OTHER",
                          is_default: !!data.is_default,
                        }),
                        ...prev.banks.filter(
                          (x) => x.bank_info_uuid !== data!.bank_info_uuid
                        ),
                      ],
                    }
                  : prev
              );

              return data as PartyBankLike;
            }}
            onReloadBanks={async (party_uuid) => {
              const { data, error } = await supabase
                .from("party_bank_info")
                .select(
                  "bank_info_uuid, bank_name, bank_account_name, bank_account_number, bank_branch, account_type, is_default"
                )
                .eq("party_uuid", party_uuid)
                .order("is_default", { ascending: false })
                .order("created_at", { ascending: false });

              if (error) {
                console.error("[reload banks] failed", error);
                return [];
              }
              return (data ?? []) as PartyBankLike[];
            }}
            autoSelectNew
            disabled={!party}
            error={form.formState.errors.bank_info_uuid?.message}
            className="w-full"
          />
        </div>

        {/* Note ID */}
        <FormField
          control={form.control}
          name="note_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>เลขที่เอกสาร (ไม่ซ้ำในคู่ค้าเดียวกัน)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="เช่น INV-2025-001" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Counts & Amounts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField
            control={form.control}
            name="bill_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>จำนวนบิล</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="total_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>จำนวนเงิน (หักส่วนลดแล้ว)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="discount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ส่วนลด</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* proof_of_payment can stay simple */}
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
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>บิลวันที่</FormLabel>
                <FormControl>
                  <DatePickerInput field={field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>สิ้นสุด</FormLabel>
                <FormControl>
                  <DatePickerInput field={field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>กำหนดชำระ</FormLabel>
                <FormControl>
                  <DatePickerInput field={field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Optional dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="payment_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>วันโอนจริง (ถ้ามี)</FormLabel>
                <FormControl>
                  <DatePickerInput field={field} timePicker optional />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="kbiz_datetime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>เตือนโอน KBIZ (ถ้ามี)</FormLabel>
                <FormControl>
                  <DatePickerInput field={field} timePicker optional />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Remark */}
        <FormField
          control={form.control}
          name="remark"
          render={({ field }) => (
            <FormItem>
              <FormLabel>หมายเหตุ</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  {...field}
                  placeholder="ระบุหมายเหตุ (ถ้ามี)"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={submitting}>
            {isEdit ? "บันทึกการแก้ไข" : "สร้างรายการ"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/* ---------- error helpers ---------- */
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
