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
import { SkuLookupRow } from "@/lib/types/models";

export type PosLineDraft = {
  temp_id: string;
  sku_uuid: string;
  sku_code?: string;
  product_name?: string;
  base_uom?: string;

  qty: number;
  unit_price: number; // exclusive (sent to DB)
  unit_price_inc_tax: number; // UI-only inclusive
  line_discount_amount: number; // 2dp
  effective_tax_rate: number; // e.g. 7.00 or 0.00
};

export type PaymentDraft = {
  temp_id: string;
  pos_payment_method_code: string;
  amount: number;
  txn_ref?: string;
};

type LocationRow = {
  location_uuid: string;
  location_code: string;
  location_name: string;
  is_active: boolean;
};
type PriceListRow = {
  price_list_uuid: string;
  name: string;
  is_active: boolean;
};

export type PosContextType = {
  locations: LocationRow[];
  priceLists: PriceListRow[];
  loadingInit: boolean;

  locationUuid?: string;
  setLocationUuid: (v?: string) => void;
  priceListUuid?: string;
  setPriceListUuid: (v?: string) => void;

  receiptNumber: string;
  setReceiptNumber: (v: string) => void;
  customerRef?: string;
  setCustomerRef: (v?: string) => void;

  // header charges (included AFTER VAT; match RPC policy)
  headerDiscount: number;
  setHeaderDiscount: (n: number) => void;
  freightAmount: number;
  setFreightAmount: (n: number) => void;
  otherCharge: number;
  setOtherCharge: (n: number) => void;

  lines: PosLineDraft[];
  addLineByInput: (input: string) => Promise<void>; // barcode or sku code
  updateLine: (id: string, patch: Partial<PosLineDraft>) => void;
  removeLine: (id: string) => void;
  clearLines: () => void;

  payments: PaymentDraft[];
  addPayment: () => void;
  updatePayment: (id: string, patch: Partial<PaymentDraft>) => void;
  removePayment: (id: string) => void;
  clearPayments: () => void;

  totalBeforeTax: number;
  vatTotal: number;
  grandTotal: number;
  paidTotal: number;
  changeDue: number;

  submit: () => Promise<string | undefined>;
  submitting: boolean;
  canSubmit: boolean;
  submitError?: string;
  setSubmitError: (e?: string) => void;
};

export const PosContext = createContext<PosContextType | null>(null);

export default function PosProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  const [locationUuid, setLocationUuid] = useState<string>();
  const [priceListUuid, setPriceListUuid] = useState<string>();
  const [receiptNumber, setReceiptNumber] = useState("");
  const [customerRef, setCustomerRef] = useState<string>();

  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [freightAmount, setFreightAmount] = useState(0);
  const [otherCharge, setOtherCharge] = useState(0);

  const [lines, setLines] = useState<PosLineDraft[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>([
    {
      temp_id: uuidv4(),
      pos_payment_method_code: "CASH",
      amount: 0,
      txn_ref: "",
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const today = new Date().toISOString().slice(0, 10);

  const fetchUnitPrice = useCallback(
    async (sku_uuid: string, base_uom: string, taxRatePct: number) => {
      if (!priceListUuid) return { unitExcl: 0, unitIncl: 0 };

      const { data, error } = await supabase
        .from("price_list_item")
        .select(
          `
        unit_price,
        pack_uom_code,
        qty_per_pack,
        valid_from,
        valid_to,
        price_list:price_list_uuid ( is_tax_inclusive )
      `
        )
        .eq("price_list_uuid", priceListUuid)
        .eq("sku_uuid", sku_uuid)
        .eq("pack_uom_code", base_uom)
        .eq("qty_per_pack", 1)
        .lte("valid_from", today)
        .or(`valid_to.is.null,valid_to.gte.${today}`)
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return { unitExcl: 0, unitIncl: 0 };

      const listPrice = Number(data?.unit_price ?? 0);
      const isInc = Boolean(data?.price_list?.[0]?.is_tax_inclusive);
      const rate = Number(taxRatePct || 0) / 100;

      const unitExcl = isInc
        ? +(listPrice / (1 + rate)).toFixed(6)
        : +listPrice.toFixed(6);
      const unitIncl = isInc
        ? +listPrice.toFixed(6)
        : +(unitExcl * (1 + rate)).toFixed(6);

      return { unitExcl, unitIncl };
    },
    [priceListUuid, supabase, today]
  );

  // init
  useEffect(() => {
    (async () => {
      setLoadingInit(true);
      const [{ data: locs }, { data: pls }] = await Promise.all([
        supabase
          .from("location")
          .select("location_uuid,location_code,location_name,is_active")
          .eq("is_active", true)
          .order("location_code"),
        supabase
          .from("price_list")
          .select("price_list_uuid,name,is_active")
          .eq("is_active", true)
          .order("name"),
      ]);
      setLocations((locs ?? []) as LocationRow[]);
      setPriceLists((pls ?? []) as PriceListRow[]);
      setLoadingInit(false);
    })();
  }, [supabase]);

  // add line by barcode or sku_code
  const addLineByInput = useCallback(
    async (input: string) => {
      const term = input.trim();
      if (!term) return;

      // 1) Try barcode exact match
      const { data: bData, error: bErr } = await supabase
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
        .eq("barcode", term)
        .maybeSingle();

      let hit: SkuLookupRow | null = null;
      if (!bErr && bData?.sku && !Array.isArray(bData.sku)) {
        hit = bData.sku as SkuLookupRow;
      } else {
        // 2) Fallback to SKU code search
        const { data: sData, error: sErr } = await supabase
          .from("sku")
          .select(
            `
        sku_uuid,
        sku_code,
        uom_code,
        product:product_uuid ( product_name )
      `
          )
          .ilike("sku_code", `%${term}%`)
          .limit(1)
          .maybeSingle();

        if (!sErr && sData) {
          hit = sData as unknown as SkuLookupRow;
        }
      }

      if (!hit) {
        setSubmitError(`ไม่พบสินค้า: ${term}`);
        return;
      }

      const prodName = Array.isArray(hit.product)
        ? hit.product[0]?.product_name ?? ""
        : hit.product?.product_name ?? "";

      const defaultVat = 7.0;
      const { unitExcl, unitIncl } = await fetchUnitPrice(
        hit.sku_uuid,
        hit.uom_code,
        defaultVat
      );

      setLines((prev) => {
        const exists = prev.find((x) => x.sku_uuid === hit!.sku_uuid);
        if (exists)
          return prev.map((x) =>
            x.temp_id === exists.temp_id ? { ...x, qty: x.qty + 1 } : x
          );
        return [
          {
            temp_id: uuidv4(),
            sku_uuid: hit.sku_uuid,
            sku_code: hit.sku_code,
            product_name: prodName,
            base_uom: hit.uom_code,
            qty: 1,
            unit_price: unitExcl,
            unit_price_inc_tax: unitIncl,
            line_discount_amount: 0,
            effective_tax_rate: defaultVat,
          },
          ...prev,
        ];
      });
    },
    [supabase, fetchUnitPrice]
  );

  // keep inclusive/exclusive in sync, and sanitize numbers to avoid uncontrolled inputs
  const updateLine = useCallback((id: string, patch: Partial<PosLineDraft>) => {
    setLines((prev) =>
      prev.map((r) => {
        if (r.temp_id !== id) return r;
        const next = { ...r, ...patch };

        // if user changed inclusive price, recompute exclusive
        if (patch.unit_price_inc_tax !== undefined) {
          const rate = Number(next.effective_tax_rate || 0) / 100;
          next.unit_price = +(
            Number(patch.unit_price_inc_tax) /
            (1 + rate)
          ).toFixed(6);
        }

        // if user changed exclusive price (not inclusive at same time), recompute inclusive
        if (
          patch.unit_price !== undefined &&
          patch.unit_price_inc_tax === undefined
        ) {
          const rate = Number(next.effective_tax_rate || 0) / 100;
          next.unit_price_inc_tax = +(
            Number(patch.unit_price) *
            (1 + rate)
          ).toFixed(6);
        }

        // if user changed effective_tax_rate, resync inclusive from exclusive
        if (
          patch.effective_tax_rate !== undefined &&
          patch.unit_price_inc_tax === undefined
        ) {
          const rate = Number(patch.effective_tax_rate || 0) / 100;
          next.unit_price_inc_tax = +(
            Number(next.unit_price || 0) *
            (1 + rate)
          ).toFixed(6);
        }

        // sanitize numbers
        next.qty = Number(next.qty || 0);
        next.unit_price = Number(next.unit_price || 0);
        next.unit_price_inc_tax = Number(next.unit_price_inc_tax || 0);
        next.line_discount_amount = Number(next.line_discount_amount || 0);
        next.effective_tax_rate = Number(next.effective_tax_rate || 0);

        return next;
      })
    );
  }, []);

  const removeLine = useCallback(
    (id: string) => setLines((prev) => prev.filter((r) => r.temp_id !== id)),
    []
  );
  const clearLines = useCallback(() => setLines([]), []);

  // payments
  const addPayment = useCallback(() => {
    setPayments((prev) => [
      ...prev,
      {
        temp_id: uuidv4(),
        pos_payment_method_code: "CASH",
        amount: 0,
        txn_ref: "",
      },
    ]);
  }, []);
  const updatePayment = useCallback(
    (id: string, patch: Partial<PaymentDraft>) => {
      setPayments((prev) =>
        prev.map((p) =>
          p.temp_id === id
            ? { ...p, ...patch, amount: Number(patch.amount ?? p.amount ?? 0) }
            : p
        )
      );
    },
    []
  );
  const removePayment = useCallback(
    (id: string) => setPayments((prev) => prev.filter((p) => p.temp_id !== id)),
    []
  );
  const clearPayments = useCallback(
    () =>
      setPayments([
        { temp_id: uuidv4(), pos_payment_method_code: "CASH", amount: 0 },
      ]),
    []
  );

  // totals (mirror DB generated cols + header policy)
  const { totalBeforeTax, vatTotal, grandTotal, paidTotal, changeDue } =
    useMemo(() => {
      let base = 0,
        vat = 0;
      for (const r of lines) {
        const gross = +(Number(r.qty || 0) * Number(r.unit_price || 0)).toFixed(
          2
        );
        const taxable = +Math.max(
          0,
          gross - Number(r.line_discount_amount || 0)
        ).toFixed(2);
        const v = +(
          (taxable * Number(r.effective_tax_rate || 0)) /
          100
        ).toFixed(2);
        base += taxable;
        vat += v;
      }
      const headerAdj =
        Number(freightAmount || 0) +
        Number(otherCharge || 0) -
        Number(headerDiscount || 0);
      const grand = +(base + vat + headerAdj).toFixed(2);
      const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const change = +(paid - grand).toFixed(2);
      return {
        totalBeforeTax: +base.toFixed(2),
        vatTotal: +vat.toFixed(2),
        grandTotal: grand,
        paidTotal: paid,
        changeDue: change,
      };
    }, [lines, headerDiscount, freightAmount, otherCharge, payments]);

  const canSubmit = Boolean(locationUuid && priceListUuid && lines.length > 0);
  const submit = useCallback(async (): Promise<string | undefined> => {
    setSubmitError(undefined);
    if (!canSubmit) {
      setSubmitError("กรุณาเลือกสาขา/ราคาขาย และเพิ่มสินค้า");
      return;
    }
    setSubmitting(true);
    try {
      const linePayload = lines.map((l) => ({
        sku_uuid: l.sku_uuid,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price),
        line_discount_amount: Number(l.line_discount_amount ?? 0),
        effective_tax_rate: Number(l.effective_tax_rate ?? 0),
      }));
      const payPayload = payments.map((p) => ({
        pos_payment_method_code: p.pos_payment_method_code,
        amount: Number(p.amount),
        txn_ref: p.txn_ref || null,
      }));

      const { data, error } = await supabase.rpc(
        "fn_pos_sale_create_and_post",
        {
          in_location_uuid: locationUuid,
          in_price_list_uuid: priceListUuid,
          in_receipt_number: receiptNumber || null,
          in_sale_datetime: null,
          in_customer_ref: customerRef || null,
          in_header_discount: headerDiscount ?? 0,
          in_freight_amount: freightAmount ?? 0,
          in_other_charge: otherCharge ?? 0,
          in_lines: linePayload,
          in_payments: payPayload,
        }
      );

      if (error) {
        setSubmitError(error.message);
        return;
      }

      // reset
      clearLines();
      clearPayments();
      setReceiptNumber("");
      setHeaderDiscount(0);
      setFreightAmount(0);
      setOtherCharge(0);

      return data as string; // pos_sale_uuid
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    supabase,
    locationUuid,
    priceListUuid,
    receiptNumber,
    customerRef,
    headerDiscount,
    freightAmount,
    otherCharge,
    lines,
    payments,
    clearLines,
    clearPayments,
  ]);

  const value: PosContextType = {
    locations,
    priceLists,
    loadingInit,
    locationUuid,
    setLocationUuid,
    priceListUuid,
    setPriceListUuid,
    receiptNumber,
    setReceiptNumber,
    customerRef,
    setCustomerRef,

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
    payments,
    addPayment,
    updatePayment,
    removePayment,
    clearPayments,

    totalBeforeTax,
    vatTotal,
    grandTotal,
    paidTotal,
    changeDue,
    submit,
    submitting,
    canSubmit,
    submitError,
    setSubmitError,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
