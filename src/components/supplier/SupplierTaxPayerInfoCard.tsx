import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext } from "react";
import { SupplierContext, SupplierContextType } from "./SupplierProvider";
import SupplierTaxPayerFormDialog from "./SupplierTaxPayerForm/SupplierTaxPayerFormDialog";
import { Button } from "../ui/button";
import { supplierTaxPayerFormDefaultValues } from "./SupplierTaxPayerForm/SupplierTaxPayerForm";
import { Pencil, Plus } from "lucide-react";
import SupplierTaxPayerDeleteDialog from "./SupplierTaxPayerForm/SupplierTaxPayerDeleteDialog";

export function SupplierTaxPayerInfoCard() {
  const { selectedRow, setOpenCreateTaxFormDialog, openCreateTaxFormDialog } =
    useContext(SupplierContext) as SupplierContextType;

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="text-lg text-center bg-slate-100">
          ข้อมูลผู้เสียภาษี
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm flex flex-col gap-4 items-stretch max-w-xl">
        {selectedRow && (
          <div className="flex items-center">
            <h2 className="text-lg font-semibold items-baseline px-4">
              {selectedRow.supplier_name}
            </h2>
            {selectedRow?.supplier_tax_info && (
              <>
                <SupplierTaxPayerFormDialog
                  open={openCreateTaxFormDialog}
                  setOpen={setOpenCreateTaxFormDialog}
                  dialogTrigger={
                    <Button size="sm" variant="ghost">
                      <Pencil />
                    </Button>
                  }
                  dialogHeader="แก้ไขข้อมูลผู้เสียภาษี"
                  defaultValues={{
                    tax_payer_id: selectedRow.supplier_tax_info.tax_payer_id,
                    address: selectedRow.supplier_tax_info.address,
                  }}
                  update
                />
                <SupplierTaxPayerDeleteDialog />
              </>
            )}
          </div>
        )}

        {selectedRow?.supplier_tax_info ? (
          <div>
            <div className="grid grid-cols-3 gap-y-1">
              <span className="font-medium col-span-1">
                เลขประจำตัวผู้เสียภาษี:
              </span>
              <span className="col-span-2">
                {selectedRow.supplier_tax_info.tax_payer_id}
              </span>

              <span className="font-medium col-span-1">ที่อยู่:</span>
              <span className="col-span-2 whitespace-pre-line">
                {selectedRow.supplier_tax_info.address}
              </span>
            </div>
          </div>
        ) : (
          <div className="self-start">
            {selectedRow && (
              <SupplierTaxPayerFormDialog
                open={openCreateTaxFormDialog}
                setOpen={setOpenCreateTaxFormDialog}
                dialogTrigger={
                  <Button variant="default">
                    <Plus /> เพิ่มข้อมูลผู้เสียภาษี
                  </Button>
                }
                dialogHeader="เพิ่มข้อมูลผู้เสียภาษี"
                defaultValues={supplierTaxPayerFormDefaultValues}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
