// app/(purchasing)/purchasing/dn/[dn_uuid]/page.tsx
import DNFormShadcn from "@/components/purchasing/DNFormShadcn";
import LocationUuidPicker from "@/components/purchasing/LocationUuidPicker";
import SKUUIDPicker from "@/components/purchasing/SKUUIDPicker";
import SupplierPartyPicker from "@/components/purchasing/SupplierPartyPicker";
import { createClient } from "@/lib/supabase/server";

type Params = { dn_uuid: string };

export default async function EditDNPage({
  params,
}: {
  params: Promise<Params>; // <-- Promise!
}) {
  const { dn_uuid } = await params; // <-- await it

  const supabase = await createClient();

  const { data: header, error: hErr } = await supabase
    .from("purchase_dn")
    .select("*")
    .eq("dn_uuid", dn_uuid)
    .single();
  if (hErr) throw hErr;

  const { data: lines, error: lErr } = await supabase
    .from("purchase_dn_line")
    .select("*")
    .eq("dn_uuid", dn_uuid)
    .order("line_no", { ascending: true });
  if (lErr) throw lErr;

  return (
    <DNFormShadcn
      initial={{ header, lines: lines ?? [] }}
      SupplierField={SupplierPartyPicker}
      LocationField={LocationUuidPicker}
      SKUField={SKUUIDPicker}
    />
  );
}
