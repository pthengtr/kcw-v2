// components/purchase/PurchaseProvider.tsx
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
import { LocationRow, PurchaseLineDraft } from "@/lib/types/models";

type SkuLookupRow = {
  sku_uuid: string;
  sku_code: string;
  uom_code: string; // base uom
  product: { product_name: string } | null;
};

type BarcodeLookupRow = {
  barcode: string;
  sku: SkuLookupRow | null;
};

type SkuBasic = {
  sku_uuid: string;
  sku_code: string;
  base_uom: string;
  product_name: string;
};

export type PurchaseContextType = {
  locations: LocationRow[];
  loadingLocations: boolean;
  selectedLocation?: string;
  setSelectedLocation: (uuid: string | undefined) => void;

  supplierName: string;
  setSupplierName: (s: string) => void;

  docNumber: string;
  setDocNumber: (s: string) => void;

  lines: PurchaseLineDraft[];
  addLineByInput: (input: string) => Promise<void>; // barcode or sku code
  updateLine: (temp_id: string, patch: Partial<PurchaseLineDraft>) => void;
  removeLine: (temp_id: string) => void;
  clearLines: () => void;

  subTotal: number;
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

  const subTotal = useMemo(
    () =>
      lines.reduce(
        (s, r) => s + Number(r.qty || 0) * Number(r.unit_cost || 0),
        0
      ),
    [lines]
  );

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
            product:product_uuid (
              product_name
            )
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
          product:product_uuid (
            product_name
          )
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
            x.temp_id === exists.temp_id
              ? { ...x, qty, line_total: qty * Number(exists.unit_cost || 0) }
              : x
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
            line_total: 0,
          },
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
          next.qty = Number(next.qty || 0);
          next.unit_cost = Number(next.unit_cost || 0);
          next.line_total = Number(next.qty) * Number(next.unit_cost);
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
      }));

      const { data, error } = await supabase.rpc(
        "fn_purchase_create_and_post",
        {
          in_supplier_name: supplierName,
          in_location_uuid: selectedLocation,
          in_doc_number: docNumber || null,
          in_doc_date: null, // server current_date
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
    lines,
    addLineByInput,
    updateLine,
    removeLine,
    clearLines,
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
