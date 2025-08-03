import { ChangeEvent, useContext, useEffect, useState } from "react";
import { FieldValues } from "react-hook-form";

import { createClient } from "@/lib/supabase/client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";

type ExpenseSelectItemDialogInputProps = {
  field: FieldValues;
};

export default function ExpenseSelectItemDialogInput({
  field,
}: ExpenseSelectItemDialogInputProps) {
  const [filterText, setFilterText] = useState("");

  const { expenseItems, setExpenseItems } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  useEffect(() => {
    async function getExpenseItem(filterText: string) {
      const supabase = createClient();
      const query = supabase
        .from("expense_item")
        .select("*, expense_category(*)")
        .ilike("item_name", `%${filterText}%`)
        .limit(100);

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) setExpenseItems(data);
    }

    getExpenseItem(filterText);
  }, [field, filterText, setExpenseItems]);

  function handleSupplierChange(value: string) {
    field.onChange(value);
  }

  function handleFilterChange(e: ChangeEvent<HTMLInputElement>) {
    setFilterText(e.target.value);
  }

  const sortedExpenseItemOptions = expenseItems.sort((a, b) =>
    a.expense_category.category_name.localeCompare(
      b.expense_category.category_name
    )
  );

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            {field.value
              ? expenseItems.find((item) => item.item_uuid === field.value)
                  ?.item_name
              : "ประเภทค่าใช้จ่าย"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <div className="p-2">
              <Input
                placeholder="ประเภทค่าใช้จ่าย..."
                value={filterText}
                onChange={(e) => handleFilterChange(e)}
                className="h-8"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="max-h-96 overflow-y-auto">
            {sortedExpenseItemOptions.map((item) => (
              <DropdownMenuItem
                className="grid grid-cols-2"
                key={item.item_name}
                onClick={() => handleSupplierChange(item.item_uuid)}
              >
                <div>{item.item_name}</div>
                <div>{item.expense_category.category_name}</div>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
