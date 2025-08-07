"use client";

import SupplierTable from "./SupplierTable/SupplierTable";
import { SupplierTaxPayerInfoCard } from "./SupplierTaxPayerInfoCard";
import SupplierSearchForm from "./SupplierSearchForm/SupplierSearchForm";

export default function SupplierPage() {
  return (
    <section className="flex flex-col items-center">
      <div className="flex gap-4 items-end p-2">
        <SupplierSearchForm
          defaultValues={{
            supplier_code: "",
            supplier_name: "",
          }}
        />
      </div>
      <div className="grid grid-cols-2 ">
        <div className="flex flex-col items-center gap-4 p-2 h-[75vh]">
          <SupplierTable />
        </div>
        <div className="p-2">
          <SupplierTaxPayerInfoCard />
        </div>
      </div>
    </section>
  );
}
