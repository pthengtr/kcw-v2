import { ChangeEvent, useEffect, useState } from "react";
import { Input } from "../ui/input";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "../ui/button";
import { SupplierType } from "@/lib/types/models";

type CommonSupplierNameInputProps = {
  selectedSupplier: SupplierType | undefined;
  setSelectedSupplier: (selectedRow: SupplierType | undefined) => void;
};

export default function CommonSupplierNameInput({
  selectedSupplier,
  setSelectedSupplier,
}: CommonSupplierNameInputProps) {
  const [filterText, setFilterText] = useState("");
  const [supplierOptions, setSupplierOptions] = useState<SupplierType[]>([]);
  const [inputTab, setInputTab] = useState("company-code");

  useEffect(() => {
    async function getSupplier(filterText: string) {
      const supabase = createClient();
      let query = supabase.from("supplier").select("*").limit(50);

      if (inputTab === "company-code") {
        query = query.ilike("supplier_code", `%${filterText}%`);
      } else {
        query = query.ilike("supplier_name", `%${filterText}%`);
      }

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) setSupplierOptions(data);
    }

    if (filterText.length > 1) {
      getSupplier(filterText);
    }

    if (filterText === "") {
      setSupplierOptions([]);
    }
  }, [filterText, inputTab]);

  function handleSupplierChange(supplier: SupplierType) {
    setSelectedSupplier(supplier);
  }

  function handleFilterChange(e: ChangeEvent<HTMLInputElement>) {
    setFilterText(e.target.value);
  }

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger
          asChild
          className="max-w-72 truncate flex justify-start"
        >
          <Button variant="outline">
            {selectedSupplier ? (
              <>
                <span className="font-bold">
                  {selectedSupplier.supplier_code}
                </span>
                <span>{selectedSupplier.supplier_name}</span>
              </>
            ) : (
              "เลือกบริษัท"
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            <div className="p-2">
              <Tabs
                value={inputTab}
                onValueChange={setInputTab}
                className="flex flex-col "
              >
                <TabsList className="flex">
                  <TabsTrigger className="flex-1" value="company-code">
                    ชื่อย่อ
                  </TabsTrigger>
                  <TabsTrigger className="flex-1" value="company-name">
                    ชื่อบริษัท
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="company-code">
                  <Input
                    placeholder="ชื่อย่อบริษัท..."
                    value={filterText}
                    onChange={(e) => handleFilterChange(e)}
                    className="h-8"
                  />
                </TabsContent>
                <TabsContent value="company-name">
                  <Input
                    placeholder="ชื่อบริษัท..."
                    value={filterText}
                    onChange={(e) => handleFilterChange(e)}
                    className="h-8"
                  />
                </TabsContent>
              </Tabs>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {supplierOptions.map((supplier) => (
            <DropdownMenuItem
              className=""
              key={supplier.supplier_code}
              onClick={() => handleSupplierChange(supplier)}
            >
              <div className="font-bold">{supplier.supplier_code}</div>
              <div>{supplier.supplier_name}</div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
