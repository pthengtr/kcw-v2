import { useContext } from "react";
import ExpenseGeneralFormDialog from "./ExpenseGeneralCreateFormDialog";
import ExpenseGeneralTable from "./ExpenseGeneralTable";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { Pencil, Plus } from "lucide-react";
import { expenseGeneralFormDefaultValues } from "./ExpenseGeneralCreateForm";
import { Button } from "@/components/ui/button";
import ExpenseGeneralDeleteDialog from "./ExpenseGeneralDeleteDialog";
import ExpenseGeneralSearchForm from "./ExpenseGeneralSearchForm";

export default function ExpenseGeneralPage() {
  const {
    openCreateExpenseGeneralDialog,
    setOpenCreateExpenseGeneralDialog,
    openUpdateExpenseGeneralDialog,
    setOpenUpdateExpenseGeneralDialog,
    selectedGeneralEntry,
  } = useContext(ExpenseContext) as ExpenseContextType;

  return (
    <section className="flex w-full flex-col items-center justify-center">
      <div className="h-auto w-full min-w-0 p-2 sm:h-[90vh] sm:p-8">
        <ExpenseGeneralTable>
          <div className="flex w-full min-w-0 flex-col items-stretch justify-start gap-2 sm:flex-row sm:items-center">
            <h2 className="px-2 text-lg font-semibold sm:px-4 sm:text-xl">
              ค่าใช้จ่ายทั่วไป
            </h2>
            <div className="min-w-0">
              <ExpenseGeneralSearchForm
                defaultValues={{
                  general_entries_month: "",
                }}
              />
            </div>
          </div>
          <ExpenseGeneralFormDialog
            open={openCreateExpenseGeneralDialog}
            setOpen={setOpenCreateExpenseGeneralDialog}
            dialogTrigger={
              <Button size="sm" variant="outline">
                <Plus /> เพิ่มบิลทั่วไป
              </Button>
            }
            dialogHeader="เพิ่มบิลค่าใชัจ่ายทั่วไป"
            defaultValues={expenseGeneralFormDefaultValues}
          />
          {selectedGeneralEntry && (
            <>
              <ExpenseGeneralFormDialog
                open={openUpdateExpenseGeneralDialog}
                setOpen={setOpenUpdateExpenseGeneralDialog}
                dialogTrigger={
                  <Button size="sm" variant="outline">
                    <Pencil /> แก้ไขบิล
                  </Button>
                }
                dialogHeader="แก้ไขบิลค่าใชัจ่ายทั่วไป"
                update
                defaultValues={{
                  entry_date: new Date(selectedGeneralEntry.entry_date),
                  branch_uuid: selectedGeneralEntry.branch_uuid,
                  item_uuid: selectedGeneralEntry.item_uuid,
                  description: selectedGeneralEntry.description,
                  unit_price: selectedGeneralEntry.unit_price,
                  quantity: selectedGeneralEntry.quantity,
                  payment_uuid: selectedGeneralEntry.payment_uuid,
                  remark: selectedGeneralEntry.remark,
                }}
              />
              <ExpenseGeneralDeleteDialog />
            </>
          )}
        </ExpenseGeneralTable>
      </div>
    </section>
  );
}
