import { ChangeEvent, useEffect, useState } from "react";
import { FieldValues } from "react-hook-form";
import { Input } from "../ui/input";
import { createClient } from "@/lib/supabase/client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";

type SupplierNameInputProps = {
  field: FieldValues;
};

type SupplierType = {
  supplier_id: number;
  supplier_code: string;
  supplier_name: string;
};

export default function CommonSupplierNameInput({
  field,
}: SupplierNameInputProps) {
  const [filterText, setFilterText] = useState("");
  const [supplierOptions, setSupplierOptions] = useState<SupplierType[]>([]);

  useEffect(() => {
    async function getSupplier(filterText: string) {
      const supabase = createClient();
      const query = supabase
        .from("supplier")
        .select("*")
        .ilike("supplier_code", `%${filterText}%`)
        .limit(50);

      const { data, error } = await query;

      console.log(data, error);

      if (error) console.log(error.message);
      if (data) setSupplierOptions(data);
    }

    if (filterText.length > 1) {
      getSupplier(filterText);
    }

    if (filterText === "") {
      setSupplierOptions([]);
    }
  }, [filterText]);

  function handleSupplierChange(value: string) {
    field.onChange(value);
  }

  function handleFilterChange(e: ChangeEvent<HTMLInputElement>) {
    setFilterText(e.target.value);
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            {field.value ? field.value : "เลือกบริษัท"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <div className="p-2">
              <Input
                placeholder="ชื่อย่อบริษัท..."
                value={filterText}
                onChange={(e) => handleFilterChange(e)}
                className="h-8"
              />
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {supplierOptions.map((supplier) => (
            <DropdownMenuItem
              key={supplier.supplier_code}
              onClick={() => handleSupplierChange(supplier.supplier_code)}
            >
              {supplier.supplier_code} {supplier.supplier_name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
