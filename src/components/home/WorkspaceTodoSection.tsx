import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
} from "lucide-react";

import type {
  WorkspaceTodoItem,
  WorkspaceTodoStatus,
} from "@/lib/home/workspace-todos";
import { cn } from "@/lib/utils";

const statusStyles: Record<
  WorkspaceTodoStatus,
  {
    badge: string;
    label: string;
    icon: typeof CheckCircle2;
    value: string;
  }
> = {
  ok: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    label: "ครบแล้ว",
    icon: CheckCircle2,
    value: "text-emerald-600",
  },
  attention: {
    badge: "bg-amber-50 text-amber-700 ring-amber-100",
    label: "ต้องทำ",
    icon: ClipboardList,
    value: "text-amber-600",
  },
  urgent: {
    badge: "bg-rose-50 text-rose-700 ring-rose-100",
    label: "เร่งด่วน",
    icon: AlertTriangle,
    value: "text-rose-600",
  },
  unknown: {
    badge: "bg-slate-50 text-slate-600 ring-slate-100",
    label: "ไม่ทราบ",
    icon: CircleHelp,
    value: "text-slate-500",
  },
};

export default function WorkspaceTodoSection({
  items,
}: {
  items: WorkspaceTodoItem[];
}) {
  return (
    <section className="mt-8" aria-labelledby="workspace-summary">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            id="workspace-summary"
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            ภาพรวมพื้นที่ทำงาน
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            สถานะงานประจำวันที่ควรติดตามวันนี้
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {items.map((item) => {
          const style = statusStyles[item.status];
          const StatusIcon = style.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {item.description}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset",
                    style.badge
                  )}
                >
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden />
                  {style.label}
                </span>
              </div>

              <p className={cn("mt-4 text-2xl font-bold tracking-tight", style.value)}>
                {item.primaryValue}
              </p>
              {item.secondaryValue ? (
                <p className="mt-1 text-xs text-slate-500">
                  {item.secondaryValue}
                </p>
              ) : null}

              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition group-hover:text-blue-600">
                เปิดดูรายละเอียด
                <ArrowRight
                  className="h-3.5 w-3.5 transition group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
