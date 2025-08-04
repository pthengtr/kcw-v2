"use client";
import ExpenseReceiptDetail from "@/components/expense/summary/ExpenseReceiptDetail";
import ExpenseReceiptTable from "@/components/expense/summary/ExpenseReceiptTable";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Plus, Store } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { ExpenseContext, ExpenseContextType } from "../ExpenseProvider";
import { getMyCookie } from "@/app/(root)/action";
import { defaultExpenseReceiptColumnVisibility } from "./ExpenseReceiptColumn";
import ExpenseReceiptSearchForm from "./ExpenseReceiptSearchForm";

export default function ExpenseSummaryPage() {
  const { resetCreateReceiptForm } = useContext(
    ExpenseContext
  ) as ExpenseContextType;

  const [branchName, setBranchName] = useState("");

  const { branch } = useParams();

  const [paginationPageSize, setPaginationPageSize] = useState<
    number | undefined
  >();
  const [columnVisibility, setColumnVisibility] = useState<
    typeof defaultExpenseReceiptColumnVisibility | undefined
  >();

  useEffect(() => {
    async function getMyCookieClient<T>(
      tableName: string,
      defaultValues: T,
      setValues: (values: T) => void
    ) {
      const data = await getMyCookie(tableName);
      if (data) setValues(JSON.parse(data));
      else setValues(defaultValues);
    }

    async function getCookies() {
      await getMyCookieClient(
        "expenseReceiptColumnVisibility",
        defaultExpenseReceiptColumnVisibility,
        setColumnVisibility
      );
      await getMyCookieClient(
        "expenseReceiptPaginationPageSize",
        10,
        setPaginationPageSize
      );
    }

    getCookies();
  }, []);

  useEffect(() => {
    async function getBranchName() {
      const supabase = createClient();

      const query = supabase
        .from("branch")
        .select("*")
        .eq("branch_uuid", branch);

      const { data, error } = await query;

      if (error) console.log(error.message);
      if (data) setBranchName(data[0].branch_name);
    }

    getBranchName();
  }, [branch]);

  useEffect(() => {
    resetCreateReceiptForm();
  }, [resetCreateReceiptForm]);

  return (
    <section className="flex flex-col items-center p-2">
      <div className="flex w-full px-2">
        <div className="flex-1 flex gap-2">
          <Link className="" href={`/expense/${branch}/create`} passHref>
            <Button variant="outline">
              <Plus />
              สร้างบิลค่าใช้จ่ายใหม่
            </Button>
          </Link>
          <Link className="" href={`/expense`} passHref>
            <Button variant="outline">
              <Store />
              เลือกสาขา
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-wider">{`รายงานบิลค่าใช้จ่าย ${branchName}`}</h1>
        <div className="flex-1"></div>
      </div>

      <div className="flex flex-col w-full">
        <div className="p-2">
          {columnVisibility && paginationPageSize && (
            <ExpenseReceiptTable
              columnVisibility={columnVisibility}
              paginationPageSize={paginationPageSize}
            >
              <div className="flex gap-2 flex-1 justify-between items-center">
                <h2 className="text-xl font-bold ">{`รายการ บิลค่าใช้จ่าย`}</h2>
                <div>
                  <ExpenseReceiptSearchForm
                    defaultValues={{
                      receipt_month: "all",
                    }}
                  />
                </div>
              </div>
            </ExpenseReceiptTable>
          )}
        </div>
        <div className="p-2 flex-1">
          <ExpenseReceiptDetail />
        </div>
      </div>
    </section>
  );
}
