"use client";

import ExpenseAddEntryFormDialog from "@/components/expense/create/ExpenseAddEntryFormDialog";
import ExpenseCreateEntryTable, {
  defaultCreateEntryColumnVisibility,
} from "@/components/expense/create/ExpenseCreateEntryTable";
import {
  ExpenseContext,
  ExpenseContextType,
} from "@/components/expense/ExpenseProvider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ClipboardList, Store } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ExpenseCreateReceiptForm, {
  expenseCreateReceiptFormDefaultValues,
} from "./ExpenseCreateReceiptForm";
import { VAT } from "@/lib/utils";

export default function ExpenseCreatePage() {
  const { selectedEntry, createReceiptTab, setCreateReceiptTab } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const [branchName, setBranchName] = useState("");

  const { branch } = useParams();

  useEffect(() => {
    async function getBranchName() {
      const supabase = createClient();

      const query = supabase.from("branch").select("*").eq("branch_id", branch);

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) setBranchName(data[0].branch_name);
    }

    getBranchName();
  }, [branch]);

  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    invoice_number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    invoice_date,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tax_invoice_number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    tax_invoice_date,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    receipt_number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    vat,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    withholding,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    discount,
    ...noVatDefaultValues
  } = expenseCreateReceiptFormDefaultValues;

  return (
    <section className="flex flex-col items-center p-2">
      <div className="flex w-full p-2">
        <div className="flex-1 flex gap-2">
          <Link className="" href={`/expense/${branch}/summary`} passHref>
            <Button variant="default">
              <ClipboardList />
              รายงานบิลค่าใช้จ่าย
            </Button>
          </Link>
          <Link className="" href={`/expense`} passHref>
            <Button variant="default">
              <Store />
              เลือกสาขา
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-wider">{`สร้างบิลค่าใช้จ่าย ${branchName}`}</h1>
        <div className="flex-1 flex justify-end gap-2"></div>
      </div>

      <div className="flex w-full justify-center h-[75vh]">
        <div className="p-2 h-full">
          <Tabs
            value={createReceiptTab}
            onValueChange={setCreateReceiptTab}
            className="w-full h-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="company">บริษัท</TabsTrigger>
              <TabsTrigger value="individual">ทั่วไป</TabsTrigger>
            </TabsList>
            <TabsContent value="company" className="h-full">
              <div className="p-4 border rounded-lg mt-2 h-full overflow-auto">
                <ExpenseCreateReceiptForm
                  defaultValues={expenseCreateReceiptFormDefaultValues}
                />
              </div>
            </TabsContent>
            <TabsContent value="individual" className="h-full">
              <div className="p-4 border rounded-lg mt-2 h-full">
                <ExpenseCreateReceiptForm defaultValues={noVatDefaultValues} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="p-2 flex flex-col gap-2 h-full">
          <ExpenseCreateEntryTable
            columnVisibility={defaultCreateEntryColumnVisibility}
            paginationPageSize={10}
          >
            <div className="flex flex-1 justify-start items-center gap-2">
              <h2 className="text-xl font-bold pr-2">บิลค่าใช้จ่ายใหม่</h2>
              <ExpenseAddEntryFormDialog />
              {selectedEntry && <ExpenseAddEntryFormDialog update />}
            </div>
          </ExpenseCreateEntryTable>
          <div>
            <div>ราคา</div>
            <div>{`ภาษี ${VAT} %`}</div>
            <div>ราคารวม</div>
          </div>
        </div>
      </div>
    </section>
  );
}
