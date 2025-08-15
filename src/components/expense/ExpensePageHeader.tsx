"use client";

import { Button } from "@/components/ui/button";
import {
  ChartLine,
  ClipboardList,
  ClipboardPlus,
  FilePlus2,
  FileSpreadsheet,
  Sheet,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ExpensePageHeader({
  pageTitle,
}: {
  pageTitle: string;
}) {
  const { branch } = useParams<{ branch: string }>();

  const links = [
    {
      href: `/expense/dashboard`,
      label: "ภาพรวม",
      icon: <ChartLine className="h-4 w-4" />,
    },
    {
      href: `/expense/company/${branch}/create`,
      label: "สร้างบิลใหม่",
      icon: <FilePlus2 className="h-4 w-4" />,
    },
    {
      href: `/expense/company/${branch}/credit-note`,
      label: "สร้างใบลดหนี้ไหม่",
      icon: <ClipboardPlus className="h-4 w-4" />,
    },
    {
      href: `/expense/company/${branch}/tax-report`,
      label: "รายงานภาษีซื้อ",
      icon: <Sheet className="h-4 w-4" />,
    },
    {
      href: `/expense/company/${branch}/voucher`,
      label: "ใบสำคัญจ่าย",
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
    {
      href: `/expense/company/${branch}/manage`,
      label: "จัดการบิล",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      href: `/expense/company`,
      label: "เลือกสาขา",
      icon: <Store className="h-4 w-4" />,
    },
  ];

  return (
    <div className="flex w-full px-2 items-center">
      <div className="flex-1 flex gap-2">
        <TooltipProvider delayDuration={200}>
          {links.map(({ href, label, icon }) => (
            <Tooltip key={href}>
              <TooltipTrigger asChild>
                <Link href={href} aria-label={label}>
                  <Button size="icon" variant="outline">
                    {icon}
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      <h1 className="text-2xl font-bold tracking-wider">{pageTitle}</h1>
      <div className="flex-1" />
    </div>
  );
}
