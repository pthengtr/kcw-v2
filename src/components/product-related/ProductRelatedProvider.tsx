"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export type ProductSummary = {
  BCODE: string;
  DESCR: string | null;
  BRAND: string | null;
  MODEL: string | null;
};

export type RelatedGroup = {
  groupId: string;
  label: string;
  members: ProductSummary[];
};

export type RelatedUnionItem = {
  product: ProductSummary;
  groupIds: string[];
};

type Banner = {
  type: "success" | "error" | "info";
  message: string;
} | null;

type State = {
  loadingContext: boolean;
  saving: boolean;
  selected?: ProductSummary;
  selectedGroupIds: string[];
  groups: RelatedGroup[];
  relatedUnion: RelatedUnionItem[];
  banner: Banner;
};

type Actions = {
  searchCatalog: (term: string) => Promise<ProductSummary[]>;
  selectProduct: (product?: ProductSummary) => Promise<void>;
  refreshSelected: () => Promise<void>;
  getProductGroupIds: (bcode: string) => Promise<string[]>;
  createNewGroupWith: (product: ProductSummary) => Promise<void>;
  addProductToGroup: (
    groupId: string,
    product: ProductSummary,
  ) => Promise<void>;
  removeProductFromGroup: (groupId: string, bcode: string) => Promise<void>;
  removeProductFromGroups: (groupIds: string[], bcode: string) => Promise<void>;
  clearBanner: () => void;
};

const ProductRelatedCtx = createContext<{
  state: State;
  actions: Actions;
} | null>(null);

const PRODUCT_SELECT = "BCODE, DESCR, BRAND, MODEL";

function sanitizeSearch(term: string) {
  return term.replace(/[%_,]/g, " ").trim();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function compareProducts(a: ProductSummary, b: ProductSummary) {
  const aText = `${a.DESCR ?? ""} ${a.BRAND ?? ""} ${a.MODEL ?? ""} ${a.BCODE}`
    .trim()
    .toLowerCase();
  const bText = `${b.DESCR ?? ""} ${b.BRAND ?? ""} ${b.MODEL ?? ""} ${b.BCODE}`
    .trim()
    .toLowerCase();

  return aText.localeCompare(bText, "th");
}

export function ProductRelatedProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<State>({
    loadingContext: false,
    saving: false,
    selected: undefined,
    selectedGroupIds: [],
    groups: [],
    relatedUnion: [],
    banner: null,
  });

  const setBanner = useCallback((banner: Banner) => {
    setState((s) => ({ ...s, banner }));
  }, []);

  const searchCatalog = useCallback(
    async (term: string): Promise<ProductSummary[]> => {
      const q = sanitizeSearch(term);
      if (!q) return [];

      let req = supabase
        .from("v_pos_products_hq")
        .select(PRODUCT_SELECT)
        .order("BCODE", { ascending: true })
        .limit(20);

      if (/^\d+$/.test(q)) {
        req = req.or(
          [
            `BCODE.eq.${q}`,
            `BCODE.ilike.%${q}%`,
            `DESCR.ilike.%${q}%`,
            `MODEL.ilike.%${q}%`,
            `BRAND.ilike.%${q}%`,
          ].join(","),
        );
      } else {
        req = req.or(
          [
            `BCODE.ilike.%${q}%`,
            `DESCR.ilike.%${q}%`,
            `MODEL.ilike.%${q}%`,
            `BRAND.ilike.%${q}%`,
          ].join(","),
        );
      }

      const { data, error } = await req;

      if (error) {
        console.error("searchCatalog error", error);
        setBanner({ type: "error", message: "ค้นหาสินค้าไม่สำเร็จ" });
        return [];
      }

      return ((data ?? []) as ProductSummary[]).sort(compareProducts);
    },
    [setBanner, supabase],
  );

  const loadContextFor = useCallback(
    async (product?: ProductSummary) => {
      if (!product) {
        setState((s) => ({
          ...s,
          selected: undefined,
          selectedGroupIds: [],
          groups: [],
          relatedUnion: [],
          loadingContext: false,
        }));
        return;
      }

      setState((s) => ({
        ...s,
        loadingContext: true,
        selected: product,
      }));

      const { data: ownRows, error: ownError } = await supabase
        .from("product_related_group_map")
        .select("related_group_id")
        .eq("bcode", product.BCODE)
        .order("related_group_id", { ascending: true });

      if (ownError) {
        console.error("loadContext own groups error", ownError);
        setState((s) => ({
          ...s,
          loadingContext: false,
          selected: product,
          selectedGroupIds: [],
          groups: [],
          relatedUnion: [],
          banner: {
            type: "error",
            message: "โหลดกลุ่มของสินค้าที่เลือกไม่สำเร็จ",
          },
        }));
        return;
      }

      const selectedGroupIds = uniqueStrings(
        (ownRows ?? []).map((row) => row.related_group_id as string),
      );

      if (!selectedGroupIds.length) {
        setState((s) => ({
          ...s,
          loadingContext: false,
          selected: product,
          selectedGroupIds: [],
          groups: [],
          relatedUnion: [],
        }));
        return;
      }

      const { data: rawMapRows, error: mapError } = await supabase
        .from("product_related_group_map")
        .select("id, bcode, related_group_id")
        .in("related_group_id", selectedGroupIds)
        .order("id", { ascending: true });

      if (mapError) {
        console.error("loadContext map rows error", mapError);
        setState((s) => ({
          ...s,
          loadingContext: false,
          selected: product,
          selectedGroupIds,
          groups: [],
          relatedUnion: [],
          banner: { type: "error", message: "โหลดสมาชิกในกลุ่มไม่สำเร็จ" },
        }));
        return;
      }

      const mapRows = (rawMapRows ?? []).filter(
        (row, index, arr) =>
          arr.findIndex(
            (candidate) =>
              candidate.bcode === row.bcode &&
              candidate.related_group_id === row.related_group_id,
          ) === index,
      );

      const bcodes = uniqueStrings(mapRows.map((row) => row.bcode as string));

      const { data: productRows, error: productError } = await supabase
        .from("v_pos_products_hq")
        .select(PRODUCT_SELECT)
        .in("BCODE", bcodes);

      if (productError) {
        console.error("loadContext products error", productError);
      }

      const productMap = new Map<string, ProductSummary>();
      for (const item of (productRows ?? []) as ProductSummary[]) {
        productMap.set(item.BCODE, item);
      }

      for (const bcode of bcodes) {
        if (!productMap.has(bcode)) {
          productMap.set(bcode, {
            BCODE: bcode,
            DESCR: null,
            BRAND: null,
            MODEL: null,
          });
        }
      }

      const groups: RelatedGroup[] = selectedGroupIds.map((groupId, index) => {
        const members = mapRows
          .filter((row) => row.related_group_id === groupId)
          .map((row) => productMap.get(row.bcode as string)!)
          .sort((a, b) => {
            if (a.BCODE === product.BCODE) return -1;
            if (b.BCODE === product.BCODE) return 1;
            return compareProducts(a, b);
          });

        return {
          groupId,
          label: `กลุ่ม ${index + 1}`,
          members,
        };
      });

      const unionMap = new Map<string, RelatedUnionItem>();

      for (const group of groups) {
        for (const member of group.members) {
          if (member.BCODE === product.BCODE) continue;

          const existing = unionMap.get(member.BCODE);
          if (existing) {
            if (!existing.groupIds.includes(group.groupId)) {
              existing.groupIds.push(group.groupId);
            }
          } else {
            unionMap.set(member.BCODE, {
              product: member,
              groupIds: [group.groupId],
            });
          }
        }
      }

      const relatedUnion = [...unionMap.values()].sort((a, b) =>
        compareProducts(a.product, b.product),
      );

      setState((s) => ({
        ...s,
        loadingContext: false,
        selected: productMap.get(product.BCODE) ?? product,
        selectedGroupIds,
        groups,
        relatedUnion,
      }));
    },
    [supabase],
  );

  const getProductGroupIds = useCallback(
    async (bcode: string): Promise<string[]> => {
      const { data, error } = await supabase
        .from("product_related_group_map")
        .select("related_group_id")
        .eq("bcode", bcode)
        .order("related_group_id", { ascending: true });

      if (error) {
        console.error("getProductGroupIds error", error);
        return [];
      }

      return uniqueStrings(
        (data ?? []).map((row) => row.related_group_id as string),
      );
    },
    [supabase],
  );

  const refreshSelected = useCallback(async () => {
    await loadContextFor(state.selected);
  }, [loadContextFor, state.selected]);

  const createNewGroupWith = useCallback(
    async (target: ProductSummary) => {
      if (!state.selected) return;
      if (target.BCODE === state.selected.BCODE) {
        setBanner({
          type: "info",
          message: "ไม่สามารถเพิ่มสินค้าเดียวกันเข้าหากันเองได้",
        });
        return;
      }

      setState((s) => ({ ...s, saving: true }));
      const related_group_id = crypto.randomUUID();

      const { error } = await supabase
        .from("product_related_group_map")
        .insert([
          { bcode: state.selected.BCODE, related_group_id },
          { bcode: target.BCODE, related_group_id },
        ]);

      if (error) {
        console.error("createNewGroupWith error", error);
        setState((s) => ({
          ...s,
          saving: false,
          banner: { type: "error", message: "สร้างกลุ่มใหม่ไม่สำเร็จ" },
        }));
        return;
      }

      await loadContextFor(state.selected);
      setState((s) => ({
        ...s,
        saving: false,
        banner: {
          type: "success",
          message: `เพิ่ม ${target.BCODE} เข้ากลุ่มใหม่แล้ว`,
        },
      }));
    },
    [loadContextFor, setBanner, state.selected, supabase],
  );

  const addProductToGroup = useCallback(
    async (groupId: string, target: ProductSummary) => {
      if (!state.selected) return;
      if (target.BCODE === state.selected.BCODE) {
        setBanner({
          type: "info",
          message: "ไม่สามารถเพิ่มสินค้าเดียวกันเข้าหากันเองได้",
        });
        return;
      }

      const shared = state.relatedUnion.find(
        (item) => item.product.BCODE === target.BCODE,
      );

      if (shared?.groupIds.includes(groupId)) {
        setBanner({
          type: "info",
          message: `${target.BCODE} อยู่ในกลุ่มนี้อยู่แล้ว`,
        });
        return;
      }

      setState((s) => ({ ...s, saving: true }));

      const { error } = await supabase
        .from("product_related_group_map")
        .insert([{ bcode: target.BCODE, related_group_id: groupId }]);

      if (error) {
        console.error("addProductToGroup error", error);
        setState((s) => ({
          ...s,
          saving: false,
          banner: { type: "error", message: "เพิ่มสินค้าเข้ากลุ่มไม่สำเร็จ" },
        }));
        return;
      }

      await loadContextFor(state.selected);
      setState((s) => ({
        ...s,
        saving: false,
        banner: {
          type: "success",
          message: `เพิ่ม ${target.BCODE} เข้ากลุ่มแล้ว`,
        },
      }));
    },
    [loadContextFor, setBanner, state.relatedUnion, state.selected, supabase],
  );

  const removeProductFromGroup = useCallback(
    async (groupId: string, bcode: string) => {
      if (!state.selected) return;

      setState((s) => ({ ...s, saving: true }));

      const { error } = await supabase
        .from("product_related_group_map")
        .delete()
        .eq("related_group_id", groupId)
        .eq("bcode", bcode);

      if (error) {
        console.error("removeProductFromGroup error", error);
        setState((s) => ({
          ...s,
          saving: false,
          banner: { type: "error", message: "ลบสินค้าออกจากกลุ่มไม่สำเร็จ" },
        }));
        return;
      }

      await loadContextFor(state.selected);
      setState((s) => ({
        ...s,
        saving: false,
        banner: { type: "success", message: `ลบ ${bcode} ออกจากกลุ่มแล้ว` },
      }));
    },
    [loadContextFor, state.selected, supabase],
  );

  const removeProductFromGroups = useCallback(
    async (groupIds: string[], bcode: string) => {
      if (!state.selected || !groupIds.length) return;

      setState((s) => ({ ...s, saving: true }));

      const { error } = await supabase
        .from("product_related_group_map")
        .delete()
        .eq("bcode", bcode)
        .in("related_group_id", groupIds);

      if (error) {
        console.error("removeProductFromGroups error", error);
        setState((s) => ({
          ...s,
          saving: false,
          banner: { type: "error", message: "ลบสินค้าจากหลายกลุ่มไม่สำเร็จ" },
        }));
        return;
      }

      await loadContextFor(state.selected);
      setState((s) => ({
        ...s,
        saving: false,
        banner: {
          type: "success",
          message: `ลบ ${bcode} ออกจาก ${groupIds.length} กลุ่มแล้ว`,
        },
      }));
    },
    [loadContextFor, state.selected, supabase],
  );

  const actions: Actions = {
    searchCatalog,
    selectProduct: loadContextFor,
    refreshSelected,
    getProductGroupIds,
    createNewGroupWith,
    addProductToGroup,
    removeProductFromGroup,
    removeProductFromGroups,
    clearBanner: () => setBanner(null),
  };

  return (
    <ProductRelatedCtx.Provider value={{ state, actions }}>
      {children}
    </ProductRelatedCtx.Provider>
  );
}

export function useProductRelated() {
  const ctx = useContext(ProductRelatedCtx);
  if (!ctx) {
    throw new Error(
      "useProductRelated must be used within ProductRelatedProvider",
    );
  }
  return ctx;
}
