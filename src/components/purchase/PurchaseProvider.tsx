"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";
import {
  BarcodeLookupRow,
  LocationRow,
  PurchaseLineDraft,
  SkuBasic,
  SkuLookupRow,
} from "@/lib/types/models";

export type PurchaseContextType = {
  locations: LocationRow[];
  loadingLocations: boolean;
  selectedLocation?: string;
  setSelectedLocation: (uuid: string | undefined) => void;

  supplierName: string;
  setSupplierName: (s: string) => void;

  docNumber: string;
  setDocNumber: (s: string) => void;

  // header adjustments (inputs)
  headerDiscount: number;
  setHeaderDiscount: (n: number) => void;
  freightAmount: number;
  setFreightAmount: (n: number) => void;
  otherCharge: number;
  setOtherCharge: (n: number) => void;

  lines: PurchaseLineDraft[];
  addLineByInput: (input: string) => Promise<void>; // barcode or sku code
  updateLine: (temp_id: string, patch: Partial<PurchaseLineDraft>) => void;
  removeLine: (temp_id: string) => void;
  clearLines: () => void;

  // totals
  totalBeforeTax: number;
  vatTotal: number;
  grandTotal: number;
  subTotal: number; // kept for backward compatibility (sum of qty*unit)

  canSubmit: boolean;
  submitting: boolean;
  submit: () => Promise<string | undefined>; // returns purchase_uuid
  submitError?: string;
  setSubmitError: (e?: string) => void;
};

export const PurchaseContext = createContext<PurchaseContextType | null>(null);

export default function PurchaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>();
  const [supplierName, setSupplierName] = useState<string>("");
  const [docNumber, setDocNumber] = useState<string>("");

  // header adjustments
  const [headerDiscount, setHeaderDiscount] = useState<number>(0);
  const [freightAmount, setFreightAmount] = useState<number>(0);
  const [otherCharge, setOtherCharge] = useState<number>(0);

  const [lines, setLines] = useState<PurchaseLineDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  // load locations once
  useEffect(() => {
    (async () => {
      setLoadingLocations(true);
      const { data, error } = await supabase
        .from("location")
        .select("location_uuid, location_code, location_name, is_active")
        .eq("is_active", true)
        .order("location_code", { ascending: true });
      if (!error && data) setLocations(data);
      setLoadingLocations(false);
    })();
  }, [supabase]);

  // legacy subtotal (qty * unit)
  const subTotal = useMemo(
    () =>
      lines.reduce(
        (s, r) => s + Number(r.qty || 0) * Number(r.unit_cost || 0),
        0
      ),
    [lines]
  );

  // new totals that mirror DB generated columns (exclusive VAT)
  const { totalBeforeTax, vatTotal, grandTotal } = useMemo(() => {
    let base = 0;
    let vat = 0;
    for (const r of lines) {
      const qty = Number(r.qty || 0);
      const unit = Number(r.unit_cost || 0);
      const disc = Number(r.line_discount_amount || 0);
      const rate = Number(r.effective_tax_rate || 0) / 100;

      const gross = +(qty * unit).toFixed(2);
      const taxable = +Math.max(0, gross - disc).toFixed(2);
      const v = +(taxable * rate).toFixed(2);

      base += taxable;
      vat += v;
    }
    const total = +(base + vat).toFixed(2);
    return {
      totalBeforeTax: +base.toFixed(2),
      vatTotal: +vat.toFixed(2),
      grandTotal: total,
    };
  }, [lines]);

  const addLineByInput = useCallback(
    async (input: string) => {
      const term = input.trim();
      if (!term) return;

      const findByBarcode = async (
        code: string
      ): Promise<SkuBasic | undefined> => {
        const { data, error } = await supabase
          .from("barcode")
          .select(
            `
          barcode,
          sku:sku_uuid (
            sku_uuid,
            sku_code,
            uom_code,
            product:product_uuid ( product_name )
          )
        `
          )
          .eq("barcode", code)
          .maybeSingle();

        if (error) return undefined;
        const row = data as BarcodeLookupRow | null;
        if (!row?.sku) return undefined;

        return {
          sku_uuid: row.sku.sku_uuid,
          sku_code: row.sku.sku_code,
          base_uom: row.sku.uom_code,
          product_name: row.sku.product?.product_name ?? "",
        };
      };

      const findBySkuCode = async (
        q: string
      ): Promise<SkuBasic | undefined> => {
        const { data, error } = await supabase
          .from("sku")
          .select(
            `
          sku_uuid,
          sku_code,
          uom_code,
          product:product_uuid ( product_name )
        `
          )
          .ilike("sku_code", `%${q}%`)
          .limit(1)
          .maybeSingle();

        if (error) return undefined;
        const row = data as SkuLookupRow | null;
        if (!row) return undefined;

        return {
          sku_uuid: row.sku_uuid,
          sku_code: row.sku_code,
          base_uom: row.uom_code,
          product_name: row.product?.product_name ?? "",
        };
      };

      // 1) try barcode, 2) fallback to SKU code
      let hit: SkuBasic | undefined = await findByBarcode(term);
      if (!hit) hit = await findBySkuCode(term);

      if (!hit) {
        setSubmitError(`ไม่พบสินค้า: ${term}`);
        return;
      }

      // If already in the cart, +1 qty; else add new row
      setLines((prev) => {
        const exists = prev.find((x) => x.sku_uuid === hit!.sku_uuid);
        if (exists) {
          const qty = Number(exists.qty) + 1;
          return prev.map((x) =>
            x.temp_id === exists.temp_id ? { ...x, qty } : x
          );
        }
        return [
          {
            temp_id: uuidv4(),
            sku_uuid: hit.sku_uuid,
            sku_code: hit.sku_code,
            product_name: hit.product_name,
            base_uom: hit.base_uom,
            qty: 1,
            unit_cost: 0,
            unit_cost_inc_tax: 0,
            // NEW fields for your latest schema
            line_discount_amount: 0,
            effective_tax_rate: 7.0, // default; adjust if you prefer 0
          } as PurchaseLineDraft,
          ...prev,
        ];
      });
    },
    [supabase, setLines, setSubmitError]
  );

  const updateLine = useCallback(
    (temp_id: string, patch: Partial<PurchaseLineDraft>) => {
      setLines((prev) =>
        prev.map((r) => {
          if (r.temp_id !== temp_id) return r;
          const next = { ...r, ...patch };

          // When inclusive price is changed
          if (patch.unit_cost_inc_tax !== undefined) {
            const rate = Number(next.effective_tax_rate || 0) / 100;
            next.unit_cost = +(
              Number(patch.unit_cost_inc_tax) /
              (1 + rate)
            ).toFixed(6);
          }

          // When exclusive price is changed
          if (
            patch.unit_cost !== undefined &&
            patch.unit_cost_inc_tax === undefined
          ) {
            const rate = Number(next.effective_tax_rate || 0) / 100;
            next.unit_cost_inc_tax = +(
              Number(patch.unit_cost) *
              (1 + rate)
            ).toFixed(6);
          }

          // Keep all numeric
          next.qty = Number(next.qty || 0);
          next.unit_cost = Number(next.unit_cost || 0);
          next.unit_cost_inc_tax = Number(next.unit_cost_inc_tax || 0);
          next.line_discount_amount = Number(next.line_discount_amount || 0);
          next.effective_tax_rate = Number(next.effective_tax_rate || 0);

          return next;
        })
      );
    },
    []
  );

  const removeLine = useCallback((temp_id: string) => {
    setLines((prev) => prev.filter((r) => r.temp_id !== temp_id));
  }, []);

  const clearLines = useCallback(() => setLines([]), []);

  const canSubmit = !!selectedLocation && !!supplierName && lines.length > 0;

  const submit = useCallback(async (): Promise<string | undefined> => {
    setSubmitError(undefined);
    if (!canSubmit) {
      setSubmitError(
        "กรุณาเลือกสาขา ใส่ชื่อผู้ขาย และเพิ่มรายการอย่างน้อย 1 รายการ"
      );
      return;
    }
    setSubmitting(true);
    try {
      const payload = lines.map((l) => ({
        sku_uuid: l.sku_uuid,
        qty: Number(l.qty),
        unit_cost: Number(l.unit_cost),
        line_discount_amount: Number(l.line_discount_amount ?? 0),
        effective_tax_rate: Number(l.effective_tax_rate ?? 0),
      }));

      const { data, error } = await supabase.rpc(
        "fn_purchase_create_and_post",
        {
          in_supplier_name: supplierName,
          in_location_uuid: selectedLocation,
          in_doc_number: docNumber || null,
          in_doc_date: null, // server uses current_date
          in_header_discount: headerDiscount ?? 0,
          in_freight_amount: freightAmount ?? 0,
          in_other_charge: otherCharge ?? 0,
          in_lines: payload,
        }
      );

      if (error) {
        setSubmitError(error.message);
        return;
      }

      // success → clear cart
      clearLines();
      setDocNumber("");
      setHeaderDiscount(0);
      setFreightAmount(0);
      setOtherCharge(0);

      return data as unknown as string; // purchase_uuid
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    clearLines,
    docNumber,
    lines,
    selectedLocation,
    supplierName,
    headerDiscount,
    freightAmount,
    otherCharge,
    supabase,
  ]);

  const value: PurchaseContextType = {
    locations,
    loadingLocations,
    selectedLocation,
    setSelectedLocation,
    supplierName,
    setSupplierName,
    docNumber,
    setDocNumber,

    headerDiscount,
    setHeaderDiscount,
    freightAmount,
    setFreightAmount,
    otherCharge,
    setOtherCharge,

    lines,
    addLineByInput,
    updateLine,
    removeLine,
    clearLines,

    totalBeforeTax,
    vatTotal,
    grandTotal,
    subTotal,

    canSubmit,
    submitting,
    submit,
    submitError,
    setSubmitError,
  };

  return (
    <PurchaseContext.Provider value={value}>
      {children}
    </PurchaseContext.Provider>
  );
}
