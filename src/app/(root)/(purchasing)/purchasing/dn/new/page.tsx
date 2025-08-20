import DNForm from "@/components/purchasing/DNFormShadcn";
import LocationUuidPicker from "@/components/purchasing/LocationUuidPicker";
import SKUUIDPicker from "@/components/purchasing/SKUUIDPicker";
import SupplierPartyPicker from "@/components/purchasing/SupplierPartyPicker";

export default function NewDNPage() {
  return (
    <section className="px-12">
      <DNForm
        SupplierField={SupplierPartyPicker}
        LocationField={LocationUuidPicker}
        SKUField={SKUUIDPicker}
      />
    </section>
  );
}
