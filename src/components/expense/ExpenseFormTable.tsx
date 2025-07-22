"use client";

import { useState } from "react";
import ExpenseFormDialog from "./ExpenseFormDialog";
import { expenseFormDefaultValue } from "./ExpenseForm";
import { Plus } from "lucide-react";

export default function ExpenseFormTable() {
  const [open, setOpen] = useState(false);

  return (
    <section className="flex justify-end p-8">
      <ExpenseFormDialog
        open={open}
        setOpen={setOpen}
        dialogTrigger={<Plus />}
        dialogHeader="เพิ่มรายการค่าใช้จ่าย"
        defaultValues={expenseFormDefaultValue}
      />
    </section>
  );
}
