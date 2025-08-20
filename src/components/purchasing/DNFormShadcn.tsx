// components/purchasing/DNFormShadcn.tsx
"use client";

import * as React from "react";
import { useForm, useFieldArray, ControllerRenderProps } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  saveDraftDN,
  postDN,
  type DNFormData,
} from "@/app/(root)/(purchasing)/purchasing/dn/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DatePickerRHF } from "../common/DatePickerRHF";

/** ---------- Domain Types (mirror DB) ---------- */
export type DocStatus = "DRAFT" | "POSTED" | "VOID";
export type StockDomain = "TAXED" | "NONTAX";

export type PurchaseDn = {
  dn_uuid: string;
  supplier_uuid: string;
  location_uuid: string;
  dn_number: string | null;
  dn_date: string; // ISO date (yyyy-mm-dd)
  remark: string | null;
  domain_hint: StockDomain;
  status: DocStatus;
};

export type PurchaseDnLine = {
  dn_line_uuid: string;
  dn_uuid: string;
  line_no: number;
  sku_uuid: string;
  qty: number;
  provisional_unit_cost: number | null;
};

/** ---------- Zod Schema (normalize strings, coerce numbers) ---------- */
const LineSchema = z.object({
  line_no: z.coerce.number().int().positive(),
  sku_uuid: z.string().uuid({ message: "Select a SKU" }),
  qty: z.coerce.number().positive({ message: "Qty must be > 0" }),
  // Accept "", null -> normalize to null; otherwise number
  provisional_unit_cost: z
    .union([z.coerce.number(), z.literal(""), z.null()])
    .transform((v) => (v === "" || v === null ? null : (v as number)))
    .nullable()
    .optional(),
});

const FormSchema = z.object({
  dn_uuid: z.string().uuid().optional(),
  supplier_uuid: z.string().uuid({ message: "Select a supplier" }),
  location_uuid: z.string().uuid({ message: "Select a location" }),
  // Normalize null/undefined -> "" so Input never sees null
  dn_number: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? ""),
  dn_date: z
    .string()
    .min(1, "Date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  // Normalize null/undefined -> ""
  remark: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? ""),
  domain_hint: z.enum(["TAXED", "NONTAX"]).default("TAXED"),
  lines: z.array(LineSchema).min(1, "At least 1 line"),
});

export type DNFormValues = z.infer<typeof FormSchema>;

/** ---------- Optional field component contracts ---------- */

type SupplierPickerProps = {
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
};
type LocationPickerProps = SupplierPickerProps;

type SKUFieldProps = {
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  index?: number;
  locationUuid?: string;
  error?: string;
  placeholder?: string;
};
type Props = {
  initial?: {
    header: PurchaseDn;
    lines: PurchaseDnLine[];
  };
  SupplierField?: React.ComponentType<SupplierPickerProps>;
  LocationField?: React.ComponentType<LocationPickerProps>;
  SKUField?: React.ComponentType<SKUFieldProps>;
};

export default function DNFormShadcn({
  initial,
  SupplierField,
  LocationField,
  SKUField,
}: Props) {
  const isPosted: boolean = initial?.header?.status === "POSTED";

  const form = useForm<DNFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: initial
      ? {
          dn_uuid: initial.header.dn_uuid,
          supplier_uuid: initial.header.supplier_uuid,
          location_uuid: initial.header.location_uuid,
          dn_number: initial.header.dn_number ?? "",
          dn_date: initial.header.dn_date,
          remark: initial.header.remark ?? "",
          domain_hint: initial.header.domain_hint ?? "TAXED",
          lines: initial.lines.map((l, i) => ({
            line_no: l.line_no ?? i + 1,
            sku_uuid: l.sku_uuid,
            qty: Number(l.qty),
            provisional_unit_cost:
              l.provisional_unit_cost == null
                ? null
                : Number(l.provisional_unit_cost),
          })),
        }
      : {
          dn_date: new Date().toISOString().slice(0, 10),
          dn_number: "",
          remark: "",
          domain_hint: "TAXED",
          lines: [
            { line_no: 1, sku_uuid: "", qty: 1, provisional_unit_cost: null },
          ],
        },
    mode: "onBlur",
  });

  const locUuid = form.watch("location_uuid");

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
    keyName: "key", // avoid re-mount
  });

  const [busy, setBusy] = React.useState(false);
  const disabled = isPosted || busy;

  async function onSave(values: DNFormValues) {
    setBusy(true);
    try {
      // Map to server action input type (DNFormData) without `any`
      const payload: DNFormData = {
        dn_uuid: values.dn_uuid,
        supplier_uuid: values.supplier_uuid,
        location_uuid: values.location_uuid,
        dn_number: values.dn_number || null,
        dn_date: values.dn_date,
        remark: values.remark || null,
        domain_hint: values.domain_hint,
        lines: values.lines.map((l) => ({
          dn_line_uuid: undefined, // draft upsert path deletes+reinserts; leave undefined
          line_no: l.line_no,
          sku_uuid: l.sku_uuid,
          qty: l.qty,
          provisional_unit_cost: l.provisional_unit_cost ?? null,
        })),
      };
      const res = await saveDraftDN(payload);
      toast.success("Draft saved");
      if (!values.dn_uuid && res?.dn_uuid) {
        form.setValue("dn_uuid", res.dn_uuid);
        history.replaceState(null, "", `/purchasing/dn/${res.dn_uuid}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      console.error(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onPost() {
    const id = form.getValues("dn_uuid");
    if (!id) {
      toast.error("Save the draft first");
      return;
    }
    setBusy(true);
    try {
      await postDN(id);
      toast.success("Posted");
      location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Post failed";
      console.error(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Helpers to make number inputs controlled & typed:
  const numberToString = (n: number | null | undefined): string =>
    n == null || Number.isNaN(n) ? "" : String(n);

  const parseDecimal = (s: string): number | "" => {
    if (s.trim() === "") return "";
    const n = Number(s);
    return Number.isNaN(n) ? "" : n;
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSave)}
        className="p-6 space-y-6"
        noValidate
      >
        {/* Header */}
        <div className={cn("grid grid-cols-2 gap-4", disabled && "opacity-90")}>
          {/* Supplier */}
          <FormField
            control={form.control}
            name="supplier_uuid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier</FormLabel>
                <FormControl>
                  {SupplierField ? (
                    <SupplierField
                      value={field.value}
                      onChange={field.onChange}
                      disabled={disabled}
                    />
                  ) : (
                    <Input
                      placeholder="supplier_uuid"
                      {...field}
                      disabled={disabled}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Location */}
          <FormField
            control={form.control}
            name="location_uuid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  {LocationField ? (
                    <LocationField
                      value={field.value}
                      onChange={field.onChange}
                      disabled={disabled}
                    />
                  ) : (
                    <Input
                      placeholder="location_uuid"
                      {...field}
                      disabled={disabled}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* DN Number (always a string; normalized) */}
          <FormField
            control={form.control}
            name="dn_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DN Number</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* DN Date */}
          <FormField
            control={form.control}
            name="dn_date"
            render={() => (
              <FormItem>
                <FormLabel>DN Date</FormLabel>
                <FormControl>
                  <DatePickerRHF control={form.control} name="dn_date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Domain hint */}
          <FormField
            control={form.control}
            name="domain_hint"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Domain (hint)</FormLabel>
                <FormControl>
                  <select
                    className="w-full border rounded-md h-9 px-2"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disabled}
                  >
                    <option value="TAXED">TAXED</option>
                    <option value="NONTAX">NONTAX</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Remark (string; never null) */}
          <FormField
            control={form.control}
            name="remark"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Remark</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""} // ensure never null for Input
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Lines */}
        <div className="rounded-md border">
          <div className="grid grid-cols-12 px-3 py-2 text-xs uppercase text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-6">SKU</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-3 text-right">Prov. Cost</div>
          </div>

          {fields.map((f, idx) => (
            <div
              key={f.key}
              className="grid grid-cols-12 gap-2 px-3 py-2 items-center"
            >
              <div className="col-span-1 text-sm">{idx + 1}</div>

              <FormField
                control={form.control}
                name={`lines.${idx}.sku_uuid`}
                render={({ field, fieldState }) => (
                  <FormItem className="col-span-6">
                    <FormControl>
                      {SKUField ? (
                        <SKUField
                          value={field.value}
                          onChange={field.onChange}
                          disabled={disabled}
                          index={idx}
                          locationUuid={locUuid}
                          error={fieldState.error?.message}
                          placeholder="เลือกสินค้า…"
                        />
                      ) : (
                        <Input
                          placeholder="sku_uuid"
                          {...field}
                          disabled={disabled}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Qty (number as string in input, parse to number) */}
              <FormField
                control={form.control}
                name={`lines.${idx}.qty`}
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.0001"
                        className="text-right"
                        value={numberToString(field.value as number)}
                        onChange={(e) => {
                          const next = parseDecimal(e.target.value);
                          // allow empty string in UI; RHF will validate on submit
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (field as ControllerRenderProps<any, any>).onChange(
                            next === "" ? "" : next
                          );
                        }}
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Provisional cost (nullable number) */}
              <FormField
                control={form.control}
                name={`lines.${idx}.provisional_unit_cost`}
                render={({ field }) => (
                  <FormItem className="col-span-3">
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.000001"
                        className="text-right"
                        value={numberToString(field.value as number | null)}
                        onChange={(e) => {
                          const next = parseDecimal(e.target.value);
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (field as ControllerRenderProps<any, any>).onChange(
                            next === "" ? "" : next
                          );
                        }}
                        placeholder="(optional)"
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ))}

          {!isPosted && (
            <div className="flex items-center justify-between px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  append({
                    line_no: fields.length + 1,
                    sku_uuid: "",
                    qty: 1,
                    provisional_unit_cost: null,
                  } satisfies DNFormValues["lines"][number])
                }
                disabled={busy}
              >
                + Add line
              </Button>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => remove(fields.length - 1)}
                  disabled={busy}
                >
                  Remove last
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {!isPosted && (
            <>
              <Button type="submit" variant="outline" disabled={busy}>
                Save Draft
              </Button>
              <Button type="button" onClick={onPost} disabled={busy}>
                Post
              </Button>
            </>
          )}
        </div>

        {isPosted && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            This DN is <b>POSTED</b>. Editing is disabled. View stock in detail.
          </div>
        )}
      </form>
    </Form>
  );
}
