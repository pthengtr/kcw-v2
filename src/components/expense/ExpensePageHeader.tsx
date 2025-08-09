import { Button } from "@/components/ui/button";
import {
  ChartLine,
  ClipboardList,
  FileSpreadsheet,
  Plus,
  Sheet,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ExpensePageHeader({
  pageTitle,
}: {
  pageTitle: string;
}) {
  const { branch } = useParams();

  return (
    <div className="flex w-full px-2 items-center">
      <div className="flex-1 flex gap-2">
        <Link className="" href={`/expense/dashboard`} passHref>
          <Button size="sm" variant="outline">
            <ChartLine />
            ภาพรวม
          </Button>
        </Link>
        <Link className="" href={`/expense/company/${branch}/create`} passHref>
          <Button size="sm" variant="outline">
            <Plus />
            สร้างบิลใหม่
          </Button>
        </Link>
        <Link
          className=""
          href={`/expense/company/${branch}/tax-report`}
          passHref
        >
          <Button size="sm" variant="outline">
            <Sheet />
            รายงานภาษีซื้อ
          </Button>
        </Link>
        <Link className="" href={`/expense/company/${branch}/voucher`} passHref>
          <Button size="sm" variant="outline">
            <FileSpreadsheet />
            ใบสำคัญจ่าย
          </Button>
        </Link>
        <Link className="" href={`/expense/company/${branch}/manage`} passHref>
          <Button size="sm" variant="outline">
            <ClipboardList />
            จัดการบิล
          </Button>
        </Link>
        <Link className="" href={`/expense/company`} passHref>
          <Button size="sm" variant="outline">
            <Store />
            เลือกสาขา
          </Button>
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-wider">{pageTitle}</h1>
      <div className="flex-1"></div>
    </div>
  );
}
