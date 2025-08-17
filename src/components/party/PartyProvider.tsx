"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { PartyBankLike } from "../common/BankAccountPicker";

export type PartyKind = "SUPPLIER" | "CUSTOMER" | "BOTH";

export type PartyTaxInfo = {
  tax_info_uuid: string;
  legal_name: string | null;
  tax_payer_id: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type BankAccountType = "CHECKING" | "SAVINGS" | "OTHER";

export type PartyBankInfo = {
  bank_info_uuid: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string | null;
  account_type: BankAccountType;
  is_default: boolean;
};

export type Party = {
  party_uuid: string;
  party_code: string | null;
  party_name: string;
  kind: PartyKind;
  is_active: boolean;
  tax_info: PartyTaxInfo[];
  banks: PartyBankInfo[];
};

type State = {
  loading: boolean;
  items: Party[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  kind: PartyKind | "ANY";
  activeOnly: boolean;
  selected?: Party;
};

type Actions = {
  setQ: (v: string) => void;
  setKind: (k: State["kind"]) => void;
  setActiveOnly: (b: boolean) => void;
  setPage: (p: number) => void;
  setSelected: (p?: Party) => void;
  refresh: () => Promise<void>;
  createParty: (input: {
    party_code?: string | null;
    party_name: string;
    kind: PartyKind;
    is_active?: boolean;
  }) => Promise<void>;
  updateParty: (
    party_uuid: string,
    patch: Partial<Omit<Party, "party_uuid" | "tax_info" | "banks">>
  ) => Promise<void>;
  deleteParty: (party_uuid: string) => Promise<void>;

  addTaxInfo: (
    party_uuid: string,
    input: {
      legal_name?: string | null;
      tax_payer_id?: string | null;
      address?: string | null;
    }
  ) => Promise<void>;
  deleteTaxInfo: (tax_info_uuid: string) => Promise<void>;

  addBank: (
    party_uuid: string,
    input: {
      bank_name: string;
      bank_account_name: string;
      bank_account_number: string;
      bank_branch?: string | null;
      account_type?: BankAccountType;
      is_default?: boolean;
    }
  ) => Promise<PartyBankLike>;
  deleteBank: (bank_info_uuid: string) => Promise<void>;
  setDefaultBank: (party_uuid: string, bank_info_uuid: string) => Promise<void>;
};

const PartyCtx = createContext<{ state: State; actions: Actions } | null>(null);

export function PartyProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<State>({
    loading: false,
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    q: "",
    kind: "ANY",
    activeOnly: true,
    selected: undefined,
  });

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const from = (state.page - 1) * state.pageSize;
    const to = from + state.pageSize - 1;

    const like = `%${state.q.replace(/[%_]/g, " ").trim()}%`;

    let req = supabase
      .from("party")
      .select(
        `
        party_uuid,
        party_code,
        party_name,
        kind,
        is_active,
        tax_info:party_tax_info(tax_info_uuid, legal_name, tax_payer_id, address, created_at, updated_at),
        banks:party_bank_info(bank_info_uuid, bank_name, bank_account_name, bank_account_number, bank_branch, account_type, is_default)
      `,
        { count: "exact" }
      )
      .order("party_name", { ascending: true })
      .range(from, to);

    if (state.q.trim()) {
      req = req.or(`party_name.ilike.${like},party_code.ilike.${like}`);
    }

    if (state.kind === "SUPPLIER") {
      req = req.in("kind", ["SUPPLIER", "BOTH"]);
    } else if (state.kind === "CUSTOMER") {
      req = req.in("kind", ["CUSTOMER", "BOTH"]);
    } else if (state.kind === "BOTH") {
      req = req.eq("kind", "BOTH");
    }

    if (state.activeOnly) {
      req = req.eq("is_active", true);
    }

    const { data, error, count } = await req;
    if (!error && data) {
      setState((s) => ({
        ...s,
        items: data,
        total: count ?? data.length,
        loading: false,
        selected: s.selected
          ? data.find((p: Party) => p.party_uuid === s.selected?.party_uuid) ??
            s.selected
          : undefined,
      }));
    } else {
      setState((s) => ({ ...s, loading: false }));
      if (error) console.error(error);
    }
  }, [
    supabase,
    state.page,
    state.pageSize,
    state.q,
    state.kind,
    state.activeOnly,
  ]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const actions: Actions = {
    setQ: (v) => setState((s) => ({ ...s, q: v, page: 1 })),
    setKind: (k) => setState((s) => ({ ...s, kind: k, page: 1 })),
    setActiveOnly: (b) => setState((s) => ({ ...s, activeOnly: b, page: 1 })),
    setPage: (p) => setState((s) => ({ ...s, page: p })),
    setSelected: (p) => setState((s) => ({ ...s, selected: p })),
    refresh: fetchData,

    createParty: async (input) => {
      const { error } = await supabase.from("party").insert([
        {
          party_code: input.party_code ?? null,
          party_name: input.party_name,
          kind: input.kind,
          is_active: input.is_active ?? true,
        },
      ]);
      if (error) throw error;
      await fetchData();
    },

    updateParty: async (party_uuid, patch) => {
      const { error } = await supabase
        .from("party")
        .update(patch)
        .eq("party_uuid", party_uuid);
      if (error) throw error;
      await fetchData();
    },

    deleteParty: async (party_uuid) => {
      const { error } = await supabase
        .from("party")
        .delete()
        .eq("party_uuid", party_uuid);
      if (error) throw error;
      await fetchData();
    },

    addTaxInfo: async (party_uuid, input) => {
      const { error } = await supabase.from("party_tax_info").insert([
        {
          party_uuid,
          legal_name: input.legal_name ?? null,
          tax_payer_id: input.tax_payer_id ?? null,
          address: input.address ?? null,
        },
      ]);
      if (error) throw error;
      await fetchData();
    },

    deleteTaxInfo: async (tax_info_uuid) => {
      const { error } = await supabase
        .from("party_tax_info")
        .delete()
        .eq("tax_info_uuid", tax_info_uuid);
      if (error) throw error;
      await fetchData();
    },

    // PartyProvider.tsx (inside actions)
    addBank: async (party_uuid, input) => {
      // insert + return the new row
      const { data, error } = await supabase
        .from("party_bank_info")
        .insert([{ party_uuid, ...input }])
        .select(
          "bank_info_uuid, bank_name, bank_account_name, bank_account_number, bank_branch, account_type, is_default"
        )
        .single();
      if (error) throw error;

      // if set default, clear others
      if (input.is_default) {
        const { error: e2 } = await supabase
          .from("party_bank_info")
          .update({ is_default: false })
          .eq("party_uuid", party_uuid)
          .neq("bank_info_uuid", data.bank_info_uuid);
        if (e2) throw e2;
        data.is_default = true; // reflect final state
      }

      // keep the rest of the UI in sync
      await fetchData();

      // IMPORTANT: return the created row
      return data; // PartyBankLike
    },

    deleteBank: async (bank_info_uuid) => {
      const { error } = await supabase
        .from("party_bank_info")
        .delete()
        .eq("bank_info_uuid", bank_info_uuid);
      if (error) throw error;
      await fetchData();
    },

    setDefaultBank: async (party_uuid, bank_info_uuid) => {
      // clear others
      let { error } = await supabase
        .from("party_bank_info")
        .update({ is_default: false })
        .eq("party_uuid", party_uuid);
      if (error) throw error;
      // set this one
      ({ error } = await supabase
        .from("party_bank_info")
        .update({ is_default: true })
        .eq("bank_info_uuid", bank_info_uuid));
      if (error) throw error;
      await fetchData();
    },
  };

  return (
    <PartyCtx.Provider value={{ state, actions }}>{children}</PartyCtx.Provider>
  );
}

export function useParty() {
  const ctx = useContext(PartyCtx);
  if (!ctx) throw new Error("useParty must be used within PartyProvider");
  return ctx;
}
