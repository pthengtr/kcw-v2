"use client";

import * as React from "react";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

// default pickers (used as fallback if you don't inject your own)
import SupplierPartyPicker from "@/components/purchasing/SupplierPartyPicker";
import LocationUuidPicker from "@/components/purchasing/LocationUuidPicker";
import SKUUIDPicker from "@/components/purchasing/SKUUIDPicker";

import {
  upsertTI,
  postTI,
} from "@/app/(root)/(purchasing)/purchasing/ti/actions";
import MatchDNDrawer from "./MatchDNDrawer";

/** --- Picker prop contracts (same pattern as DN) --- */
export type BasePickerProps = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  className?: string;
};

export type SkuPickerProps = BasePickerProps & {
  /** helpful for lookups */
  locationUuid?: string;
};

/** --- Zod schemas --- */
const LineSchema = z.object({
  ti_line_uuid: z.string().uuid().optional(), // <- add this
  line_no: z.number().int().positive(),
  sku_uuid: z.string().uuid(),
  qty: z.number().positive(),
  unit_cost: z.number().nonnegative(),
  line_discount_amount: z.number().nonnegative().default(0),
  effective_tax_rate: z.number().nonnegative().default(0),
});

const HeaderSchema = z.object({
  ti_uuid: z.string().uuid().optional(),
  supplier_uuid: z.string().uuid(),
  location_uuid: z.string().uuid(),
  ti_number: z.string().default(""),
  ti_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  header_discount_amount: z.number().nonnegative().default(0),
  freight_amount: z.number().nonnegative().default(0),
  other_charge_amount: z.number().nonnegative().default(0),
  remark: z.string().default(""),
});

const FormSchema = z.object({
  header: HeaderSchema,
  lines: z.array(LineSchema).min(1, "ต้องมีรายการอย่างน้อย 1 รายการ"),
});

export type TIFormValue = z.infer<typeof FormSchema>;

type Props = {
  initial?: Partial<TIFormValue>;
  readOnly?: boolean;

  /** Inject custom pickers (same shape as DN) */
  SupplierPicker?: React.ComponentType<BasePickerProps>;
  LocationPicker?: React.ComponentType<BasePickerProps>;
  SkuPicker?: React.ComponentType<SkuPickerProps>;
};

function toISODate(d = new Date()) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);
}

export default function TIFormShadcn({
  initial,
  readOnly,
  SupplierPicker: SupplierPickerProp,
  LocationPicker: LocationPickerProp,
  SkuPicker: SkuPickerProp,
}: Props) {
  const Supplier =
    SupplierPickerProp ??
    ((p: BasePickerProps) => (
      <SupplierPartyPicker
        value={p.value}
        onChange={p.onChange}
        disabled={p.disabled}
        placeholder={p.placeholder ?? "เลือกผู้ขาย…"}
        error={p.error}
      />
    ));

  const Location =
    LocationPickerProp ??
    ((p: BasePickerProps) => (
      <LocationUuidPicker
        value={p.value}
        onChange={p.onChange}
        disabled={p.disabled}
        error={p.error}
      />
    ));

  const Sku =
    SkuPickerProp ??
    ((p: SkuPickerProps) => (
      <SKUUIDPicker
        value={p.value}
        onChange={p.onChange}
        locationUuid={p.locationUuid}
        disabled={p.disabled}
        error={p.error}
      />
    ));

  const form = useForm<TIFormValue>({
    resolver: zodResolver(FormSchema),
    mode: "onChange",
    defaultValues: {
      header: {
        ti_uuid: initial?.header?.ti_uuid,
        supplier_uuid: initial?.header?.supplier_uuid ?? "",
        location_uuid: initial?.header?.location_uuid ?? "",
        ti_number: initial?.header?.ti_number ?? "",
        ti_date: initial?.header?.ti_date ?? toISODate(),
        header_discount_amount: initial?.header?.header_discount_amount ?? 0,
        freight_amount: initial?.header?.freight_amount ?? 0,
        other_charge_amount: initial?.header?.other_charge_amount ?? 0,
        remark: initial?.header?.remark ?? "",
      },
      lines: initial?.lines ?? [
        {
          line_no: 1,
          sku_uuid: "",
          qty: 1,
          unit_cost: 0,
          line_discount_amount: 0,
          effective_tax_rate: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
    keyName: "key",
  });

  const disabled = !!readOnly;

  async function onSubmit(values: TIFormValue) {
    const res = await upsertTI(values);
    if (res.ti_uuid) form.setValue("header.ti_uuid", res.ti_uuid);
  }

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        {/* Header */}
        <div className="grid grid-cols-12 gap-4">
          {/* Supplier */}
          <FormField
            control={form.control}
            name="header.supplier_uuid"
            render={({ field, fieldState }) => (
              <FormItem className="col-span-6">
                <FormLabel>Supplier</FormLabel>
                <FormControl>
                  <Supplier
                    value={field.value ?? ""} // ensure string
                    onChange={(v) => field.onChange(v ?? "")}
                    disabled={disabled}
                    error={fieldState.error?.message}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Location */}
          <FormField
            control={form.control}
            name="header.location_uuid"
            render={({ field, fieldState }) => (
              <FormItem className="col-span-6">
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Location
                    value={field.value ?? ""} // ensure string
                    onChange={(v) => field.onChange(v ?? "")}
                    disabled={disabled}
                    error={fieldState.error?.message}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* TI number */}
          <FormField
            control={form.control}
            name="header.ti_number"
            render={({ field }) => (
              <FormItem className="col-span-6">
                <FormLabel>TI Number</FormLabel>
                <FormControl>
                  <Input
                    value={field.value ?? ""} // avoid null/undefined
                    onChange={(e) => field.onChange(e.target.value)}
                    disabled={disabled}
                    placeholder="Supplier invoice no."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date */}
          <FormField
            control={form.control}
            name="header.ti_date"
            render={({ field }) => (
              <FormItem className="col-span-6">
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ""} // ensure string
                    onChange={(e) => field.onChange(e.target.value)}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Charges */}
          <FormField
            control={form.control}
            name="header.header_discount_amount"
            render={({ field }) => (
              <FormItem className="col-span-4">
                <FormLabel>Header Discount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      Number.isFinite(field.value as number)
                        ? (field.value as number)
                        : 0
                    }
                    onChange={(e) =>
                      field.onChange(Number(e.target.value || 0))
                    }
                    disabled={disabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="header.freight_amount"
            render={({ field }) => (
              <FormItem className="col-span-4">
                <FormLabel>Freight</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      Number.isFinite(field.value as number)
                        ? (field.value as number)
                        : 0
                    }
                    onChange={(e) =>
                      field.onChange(Number(e.target.value || 0))
                    }
                    disabled={disabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="header.other_charge_amount"
            render={({ field }) => (
              <FormItem className="col-span-4">
                <FormLabel>Other Charges</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      Number.isFinite(field.value as number)
                        ? (field.value as number)
                        : 0
                    }
                    onChange={(e) =>
                      field.onChange(Number(e.target.value || 0))
                    }
                    disabled={disabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Remark */}
          <FormField
            control={form.control}
            name="header.remark"
            render={({ field }) => (
              <FormItem className="col-span-12">
                <FormLabel>Remark</FormLabel>
                <FormControl>
                  <Textarea
                    value={field.value ?? ""} // ensure string
                    onChange={(e) => field.onChange(e.target.value)}
                    disabled={disabled}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Lines</h3>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  line_no: (fields.at(-1)?.line_no ?? 0) + 1,
                  sku_uuid: "",
                  qty: 1,
                  unit_cost: 0,
                  line_discount_amount: 0,
                  effective_tax_rate: 0,
                })
              }
              disabled={disabled}
            >
              Add line
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-2">
            {fields.map((f, idx) => {
              const tiLineUuid = f.ti_line_uuid; // from useFieldArray fields (typed now)

              return (
                <React.Fragment key={f.key}>
                  {/* SKU */}
                  <FormField
                    control={form.control}
                    name={`lines.${idx}.sku_uuid`}
                    render={({ field, fieldState }) => (
                      <FormItem className="col-span-5">
                        <FormLabel>SKU</FormLabel>
                        <FormControl>
                          <Sku
                            value={field.value ?? ""}
                            onChange={(v) => field.onChange(v ?? "")}
                            locationUuid={form.watch("header.location_uuid")}
                            disabled={disabled}
                            error={fieldState.error?.message}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Qty */}
                  <FormField
                    control={form.control}
                    name={`lines.${idx}.qty`}
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Qty</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            value={
                              Number.isFinite(field.value as number)
                                ? (field.value as number)
                                : 0
                            }
                            onChange={(e) =>
                              field.onChange(Number(e.target.value || 0))
                            }
                            disabled={disabled}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Unit cost */}
                  <FormField
                    control={form.control}
                    name={`lines.${idx}.unit_cost`}
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Unit Cost</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.000001"
                            value={
                              Number.isFinite(field.value as number)
                                ? (field.value as number)
                                : 0
                            }
                            onChange={(e) =>
                              field.onChange(Number(e.target.value || 0))
                            }
                            disabled={disabled}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* Discount */}
                  <FormField
                    control={form.control}
                    name={`lines.${idx}.line_discount_amount`}
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Discount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            value={
                              Number.isFinite(field.value as number)
                                ? (field.value as number)
                                : 0
                            }
                            onChange={(e) =>
                              field.onChange(Number(e.target.value || 0))
                            }
                            disabled={disabled}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* VAT % */}
                  <FormField
                    control={form.control}
                    name={`lines.${idx}.effective_tax_rate`}
                    render={({ field }) => (
                      <FormItem className="col-span-1">
                        <FormLabel>VAT %</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            value={
                              Number.isFinite(field.value as number)
                                ? (field.value as number)
                                : 0
                            }
                            onChange={(e) =>
                              field.onChange(Number(e.target.value || 0))
                            }
                            disabled={disabled}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <MatchDNDrawer
                    tiLineUuid={tiLineUuid}
                    skuUuid={form.watch(`lines.${idx}.sku_uuid`)}
                    supplierUuid={form.watch("header.supplier_uuid")}
                    locationUuid={form.watch("header.location_uuid")}
                    tiLineUnitCost={Number(
                      form.watch(`lines.${idx}.unit_cost`) || 0
                    )}
                    readOnly={
                      !!readOnly ||
                      !form.watch(
                        `header.ti_uuid`
                      ) /* require saved TI before matching */
                    }
                    onChanged={() => {
                      // optional: you can refetch allocations summary for the line, or flash a toast
                    }}
                  />

                  <div className="col-span-12 -mt-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => remove(idx)}
                      disabled={disabled}
                    >
                      Remove
                    </Button>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={disabled}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const ti_uuid = form.getValues().header.ti_uuid;
              if (!ti_uuid) return;
              await postTI(ti_uuid);
            }}
            disabled={disabled || !form.getValues().header.ti_uuid}
          >
            Post
          </Button>
        </div>
      </form>
    </Form>
  );
}
