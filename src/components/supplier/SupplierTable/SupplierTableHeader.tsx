import { Pencil, Plus } from "lucide-react";
import { Button } from "../../ui/button";

import { useContext } from "react";
import { SupplierContext, SupplierContextType } from "../SupplierProvider";
import SupplierFormDialog from "../SupplierCreateForm/SupplierFormDialog";
import { supplierFormDefaultValues } from "../SupplierCreateForm/SupplierForm";
import SupplierDeleteDialog from "../SupplierCreateForm/SupplierDeleteDialog";

export default function SupplierTableHeader() {
  const {
    selectedRow,
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    setOpenUpdateDialog,
  } = useContext(SupplierContext) as SupplierContextType;

  return (
    <>
      <div className="flex gap-4 mr-auto px-8">
        <h2 className="text-2xl font-bold flex-1">{`รายชื่อบริษัท`}</h2>
      </div>
      <SupplierFormDialog
        open={openCreateDialog}
        setOpen={setOpenCreateDialog}
        dialogTrigger={
          <Button size="sm" variant="outline" id="create-expense-novat">
            <Plus />
          </Button>
        }
        dialogHeader={`เพิ่มรายชื่อบริษัท`}
        defaultValues={supplierFormDefaultValues}
      />
      {selectedRow && (
        <div className="flex gap-4">
          <SupplierFormDialog
            update
            open={openUpdateDialog}
            setOpen={setOpenUpdateDialog}
            dialogTrigger={
              <Button size="sm" variant="outline" id="create-expense-novat">
                <Pencil />
              </Button>
            }
            dialogHeader={`แก้ไขรายชื่อบริษัท`}
            defaultValues={{
              supplier_code: selectedRow.supplier_code,
              supplier_name: selectedRow.supplier_name,
            }}
          />
          <SupplierDeleteDialog />
        </div>
      )}
    </>
  );
}
