"use client";

import { useContext } from "react";
import ExpenseCategoryTable from "./ExpenseCategoryTable";
import ExpenseItemFormDialog from "./ExpenseItemFormDialog";
import ExpenseItemTable from "./ExpenseItemTable";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { Pencil, Plus } from "lucide-react";
import {
  ExpenseItemDefaultType,
  expenseItemFormDefaultValues,
} from "./ExpenseItemForm";
import ExpenseCategoryFormDialog from "./ExpenseCategoryFormDialog";
import {
  ExpenseCategoryDefaultType,
  expenseCategoryFormDefaultValues,
} from "./ExpenseCategoryForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ExpenseItemPage() {
  const {
    openAddItemDialog,
    setOpenAddItemDialog,
    openUpdateItemDialog,
    setOpenUpdateItemDialog,
    selectedItem,
    openAddCategoryDialog,
    setOpenAddCategoryDialog,
    openUpdateCategoryDialog,
    setOpenUpdateCategoryDialog,
    selectedCategory,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const expenseItemUpdateDefaultValue: ExpenseItemDefaultType = selectedItem
    ? {
        item_name: selectedItem.item_name,
        category_id: selectedItem.category_id.toString(),
      }
    : expenseItemFormDefaultValues;

  const expenseCategoryUpdateDefaultValue: ExpenseCategoryDefaultType =
    selectedCategory
      ? {
          category_name: selectedCategory.category_name,
        }
      : expenseCategoryFormDefaultValues;

  return (
    <section className="grid place-content-center p-4">
      <Tabs
        defaultValue="expense-item"
        className="w-fit flex flex-col items-center"
      >
        <TabsList>
          <TabsTrigger value="expense-item">ประเภทค่าใช้จ่าย</TabsTrigger>
          <TabsTrigger value="expense-category">หมวดค่าใช้จ่าย</TabsTrigger>
        </TabsList>
        <TabsContent value="expense-item">
          <div className="h-[90vh] flex flex-col justify-center items-center p-4 gap-2">
            <ExpenseItemTable>
              <div className="flex gap-4 justify-start items-center flex-1">
                <h2 className="font-bold text-2xl">ประเภทค่าใช้จ่าย</h2>
                <ExpenseItemFormDialog
                  open={openAddItemDialog}
                  setOpen={setOpenAddItemDialog}
                  dialogTrigger={<Plus />}
                  defaultValues={expenseItemFormDefaultValues}
                />
                {selectedItem && (
                  <ExpenseItemFormDialog
                    open={openUpdateItemDialog}
                    setOpen={setOpenUpdateItemDialog}
                    dialogTrigger={<Pencil />}
                    defaultValues={expenseItemUpdateDefaultValue}
                    update
                  />
                )}
              </div>
            </ExpenseItemTable>
          </div>
        </TabsContent>
        <TabsContent value="expense-category">
          <div className="h-[90vh] flex flex-col justify-center items-center p-4 gap-2">
            <ExpenseCategoryTable>
              <div className="flex gap-4 justify-start items-center flex-1">
                <h2 className="font-bold text-2xl">หมวดค่าใช้จ่าย</h2>
                <ExpenseCategoryFormDialog
                  open={openAddCategoryDialog}
                  setOpen={setOpenAddCategoryDialog}
                  dialogTrigger={<Plus />}
                  defaultValues={expenseCategoryFormDefaultValues}
                />
                {selectedCategory && (
                  <ExpenseCategoryFormDialog
                    open={openUpdateCategoryDialog}
                    setOpen={setOpenUpdateCategoryDialog}
                    dialogTrigger={<Pencil />}
                    defaultValues={expenseCategoryUpdateDefaultValue}
                    update
                  />
                )}
              </div>
            </ExpenseCategoryTable>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
