"use client";

import { useContext } from "react";
import ExpenseCategoryTable from "./ExpenseCategoryTable";
import ExpenseItemFormDialog from "./ExpenseItemFormDialog";
import ExpenseItemTable from "./ExpenseItemTable";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { ArrowBigLeftDash, Pencil, Plus } from "lucide-react";
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
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        category_uuid: selectedItem.category_uuid.toString(),
      }
    : expenseItemFormDefaultValues;

  const expenseCategoryUpdateDefaultValue: ExpenseCategoryDefaultType =
    selectedCategory
      ? {
          category_name: selectedCategory.category_name,
        }
      : expenseCategoryFormDefaultValues;

  return (
    <section className="flex w-full flex-col items-center p-2 sm:p-4">
      <div className="flex-1 self-start px-2 sm:px-8">
        <Link className="" href={`/home`} passHref>
          <Button variant="outline">
            <ArrowBigLeftDash strokeWidth={1} />
            กลับ
          </Button>
        </Link>
      </div>
      <Tabs
        defaultValue="expense-item"
        className="flex w-full max-w-full flex-col items-center sm:w-fit"
      >
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="expense-item">ประเภทค่าใช้จ่าย</TabsTrigger>
          <TabsTrigger value="expense-category">หมวดค่าใช้จ่าย</TabsTrigger>
        </TabsList>
        <TabsContent value="expense-item" className="w-full">
          <div className="flex h-auto min-h-[60vh] flex-col items-center justify-center gap-2 p-2 sm:h-[90vh] sm:p-4">
            <ExpenseItemTable>
              <div className="flex flex-1 flex-wrap items-center justify-start gap-2 sm:gap-4">
                <h2 className="text-xl font-bold sm:text-2xl">ประเภทค่าใช้จ่าย</h2>
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
        <TabsContent value="expense-category" className="w-full">
          <div className="flex h-auto min-h-[60vh] flex-col items-center justify-center gap-2 p-2 sm:h-[90vh] sm:p-4">
            <ExpenseCategoryTable>
              <div className="flex flex-1 flex-wrap items-center justify-start gap-2 sm:gap-4">
                <h2 className="text-xl font-bold sm:text-2xl">หมวดค่าใช้จ่าย</h2>
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
