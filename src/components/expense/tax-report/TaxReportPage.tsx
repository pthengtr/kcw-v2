"use client";

import { defaultTaxReportColumnVisibility } from "./TaxReportColumn";
import TaxReportTable from "./TaxReportTable";

export default function TaxReportPage() {
  return (
    <section className="flex flex-col items-center">
      <div className="w-fit h-[90vh] p-8">
        <TaxReportTable
          columnVisibility={defaultTaxReportColumnVisibility}
          paginationPageSize={500}
        />
      </div>
    </section>
  );
}
