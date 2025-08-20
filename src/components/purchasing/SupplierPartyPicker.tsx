// components/purchasing/SupplierPartyPicker.tsx
"use client";

import * as React from "react";
import PartySelect from "@/components/common/PartySelect"; // your component above
import { createClient } from "@/lib/supabase/client";
import type { PartyKind, PartyOption } from "@/lib/types/models";

type Props = {
  value?: string; // supplier_uuid
  onChange: (v: string) => void; // called with party_uuid
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  kind?: PartyKind | "ANY"; // defaults to SUPPLIER here
};

export default function SupplierPartyPicker({
  value,
  onChange,
  disabled,
  error,
  placeholder = "เลือกคู่ค้า…",
  kind = "SUPPLIER",
}: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [selected, setSelected] = React.useState<PartyOption | undefined>(
    undefined
  );

  // Load PartyOption when we have a UUID (for edit mode / hydration)
  React.useEffect(() => {
    let alive = true;
    async function load() {
      if (!value) {
        if (alive) setSelected(undefined);
        return;
      }
      const { data, error } = await supabase
        .from("party")
        .select(
          `
            party_uuid,
            party_code,
            party_name,
            kind,
            tax_info:party_tax_info ( tax_info_uuid, legal_name, tax_payer_id, address, created_at, updated_at ),
            banks:party_bank_info ( bank_info_uuid, bank_name, bank_account_name, bank_account_number, bank_branch, account_type, is_default ),
            contacts:party_contact ( contact_uuid, contact_name, role_title, email, phone, is_primary )
          `
        )
        .eq("party_uuid", value)
        .maybeSingle();

      if (!alive) return;
      if (error || !data) {
        setSelected(undefined);
        return;
      }
      const opt: PartyOption = {
        party_uuid: data.party_uuid,
        party_code: data.party_code ?? null,
        party_name: data.party_name,
        kind: data.kind,
        tax_info: data.tax_info ?? [],
        banks: data.banks ?? [],
        contacts: data.contacts ?? [],
      };
      setSelected(opt);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [supabase, value]);

  return (
    <PartySelect
      selectedParty={selected}
      setSelectedParty={(p) => {
        setSelected(p);
        onChange(p?.party_uuid ?? ""); // empty string clears RHF value if you allow clearing
      }}
      kind={kind}
      error={error}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
