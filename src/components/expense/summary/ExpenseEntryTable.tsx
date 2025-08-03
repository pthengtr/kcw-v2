"use client";

import { useCallback, useContext, useEffect } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { createClient } from "@/lib/supabase/client";
import { DataTable } from "@/components/common/DataTable";
import { expenseEntryColumn } from "./ExpenseEntryColumn";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useParams, useRouter } from "next/navigation";

export const defaultReceiptEntryColumnVisibility = {
  รายการเลขที่: false,
  อ้างอิงจากใบกำกับ: false,
  อ้างอิงประเภทค่าใช้จ่าย: false,
  ราคาต่อหน่วย: true,
  จำนวน: true,
  รายละเอียด: true,
  จำนวนรวม: true,
};

type ExpenseEntryTableProps = {
  columnVisibility: typeof defaultReceiptEntryColumnVisibility | undefined;
  paginationPageSize: number | undefined;
};

export default function ExpenseEntryTable({
  columnVisibility,
  paginationPageSize,
}: ExpenseEntryTableProps) {
  const {
    totalEntry,
    setTotalEntry,
    receiptEntries,
    setReceiptEntries,
    selectedReceipt,
    setSelectedEntry,
  } = useContext(ExpenseContext) as ExpenseContextType;

  const { branch } = useParams();

  const router = useRouter();

  const supabase = createClient();

  const getExpenseEntry = useCallback(
    async function () {
      const query = supabase
        .from("expense_entry")
        .select("*, expense_item(*)", { count: "exact" })
        .eq("receipt_uuid", selectedReceipt?.receipt_uuid)
        .order("entry_uuid", { ascending: true })
        .limit(500);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      console.log(data);
      if (data) {
        setReceiptEntries(data);
      }
      if (count) setTotalEntry(count);
    },
    [selectedReceipt?.receipt_uuid, setReceiptEntries, setTotalEntry, supabase]
  );

  useEffect(() => {
    if (selectedReceipt) getExpenseEntry();
  }, [getExpenseEntry, selectedReceipt]);

  function handleUpdateReceipt() {
    router.push(
      `/expense/${branch}/update-receipt?receipt-id=${selectedReceipt?.receipt_uuid}`
    );
  }

  return (
    <div className="h-full">
      <DataTable
        tableName="receiptEntries"
        columns={expenseEntryColumn}
        data={receiptEntries}
        total={totalEntry}
        setSelectedRow={setSelectedEntry}
        initialState={{
          columnVisibility: columnVisibility,
          pagination: { pageIndex: 0, pageSize: paginationPageSize },
        }}
        totalAmountKey={[]}
      >
        <h2 className="flex-1">
          {selectedReceipt ? (
            <div className="flex gap-4 items-center">
              <div>
                <div
                  className={`flex gap-3 items-center ${
                    selectedReceipt.tax_invoice_number ? "text-sm" : "text-xl"
                  }`}
                >
                  <div className="font-bold">
                    {selectedReceipt.supplier.supplier_code}
                  </div>
                  <div>{selectedReceipt.supplier.supplier_name}</div>
                </div>
                <div className="text-xl italic">
                  {selectedReceipt.tax_invoice_number}
                </div>
              </div>
              <Button variant="outline" onClick={handleUpdateReceipt}>
                <Pencil /> แก้ไขบิลนี้
              </Button>
            </div>
          ) : (
            "รายละเอียดบิล"
          )}
        </h2>
      </DataTable>
    </div>
  );
}
