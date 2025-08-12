"use client";
import { createClient } from "@/lib/supabase/client";
import { SkuCatalogRowType } from "@/lib/types/models";
import { createContext, useCallback, useState } from "react";
import React from "react";

export type ProductContextType = {
  skus: SkuCatalogRowType[] | undefined;
  setSkus: (rows: SkuCatalogRowType[] | undefined) => void;

  selectedSku: SkuCatalogRowType | undefined;
  setSelectedSku: (row: SkuCatalogRowType | undefined) => void;

  openAdjustStockDialog: boolean;
  setOpenAdjustStockDialog: (open: boolean) => void;
  openAddBarcodeDialog: boolean;
  setOpenAddBarcodeDialog: (open: boolean) => void;
  openDeleteDialog: boolean;
  setOpenDeleteDialog: (open: boolean) => void;

  submitError: string | undefined;
  setSubmitError: (error: string | undefined) => void;
  loading: boolean;

  q: string;
  setQ: (q: string) => void;

  total: number | undefined;
  setTotal: (total: number) => void;

  getSkus: () => void;
};

export const ProductContext = createContext<ProductContextType | null>(null);

type ProviderProps = { children: React.ReactNode };

export default function ProductProvider({ children }: ProviderProps) {
  const [skus, setSkus] = useState<SkuCatalogRowType[]>();
  const [selectedSku, setSelectedSku] = useState<SkuCatalogRowType>();

  const [openAdjustStockDialog, setOpenAdjustStockDialog] = useState(false);
  const [openAddBarcodeDialog, setOpenAddBarcodeDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

  const [submitError, setSubmitError] = useState<string>();
  const [total, setTotal] = useState<number>();
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");

  const getSkus = useCallback(async function () {
    setLoading(true);
    const supabase = createClient();

    const query = supabase
      .from("v_sku_catalog")
      .select("*", { count: "exact" })
      .order("sku_code", { ascending: true })
      .limit(1000);

    const { data, error, count } = await query;

    if (error) {
      console.log(error);
      setSubmitError(error.message);
      setSkus([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    console.log(data);

    setSkus(data ?? []);
    if (count !== null && count !== undefined) setTotal(count);
    setLoading(false);
  }, []);

  const value: ProductContextType = {
    skus,
    setSkus,
    selectedSku,
    setSelectedSku,

    openAdjustStockDialog,
    setOpenAdjustStockDialog,
    openAddBarcodeDialog,
    setOpenAddBarcodeDialog,
    openDeleteDialog,
    setOpenDeleteDialog,

    submitError,
    setSubmitError,
    loading,

    q,
    setQ,
    total,
    setTotal,

    getSkus,
  };

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
}
