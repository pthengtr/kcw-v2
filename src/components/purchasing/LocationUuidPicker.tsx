// components/purchasing/LocationUuidPicker.tsx
"use client";

import * as React from "react";
import LocationSelect, {
  type LocationOption,
} from "@/components/common/LocationSelect";
import { createClient } from "@/lib/supabase/client";

type Props = {
  value?: string; // location_uuid
  onChange: (v: string) => void; // uuid ('' to clear if you allow)
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  showInactive?: boolean;
};

export default function LocationUuidPicker({
  value,
  onChange,
  disabled,
  error,
  placeholder = "เลือกสาขา…",
  showInactive = false,
}: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [selected, setSelected] = React.useState<LocationOption | undefined>();

  // hydrate from uuid (edit mode)
  React.useEffect(() => {
    let alive = true;
    async function load() {
      if (!value) {
        if (alive) setSelected(undefined);
        return;
      }
      const { data, error } = await supabase
        .from("location")
        .select("location_uuid, location_code, location_name, is_active")
        .eq("location_uuid", value)
        .maybeSingle();

      if (!alive) return;
      if (error || !data) {
        setSelected(undefined);
        return;
      }
      setSelected({
        location_uuid: data.location_uuid,
        location_code: data.location_code,
        location_name: data.location_name,
        is_active: data.is_active,
      });
    }
    void load();
    return () => {
      alive = false;
    };
  }, [supabase, value]);

  return (
    <LocationSelect
      selectedLocation={selected}
      setSelectedLocation={(loc) => {
        setSelected(loc);
        onChange(loc?.location_uuid ?? ""); // pass '' to clear if allowed
      }}
      showInactive={showInactive}
      disabled={disabled}
      error={error}
      placeholder={placeholder}
    />
  );
}
