"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

import type { VatSite } from "@/lib/vat/inventory";
import { cn } from "@/lib/utils";

function SitePendingMark() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />;
}

function SiteLink({
  basePath,
  search,
  current,
  value,
  label,
}: {
  basePath: string;
  search: string;
  current: VatSite;
  value: VatSite;
  label: string;
}) {
  const params = new URLSearchParams();
  params.set("site", value);
  if (search) params.set("q", search);
  const active = current === value;
  return (
    <Link
      href={`${basePath}?${params.toString()}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium",
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
      )}
    >
      <SitePendingMark />
      {label}
    </Link>
  );
}

export function VatInventorySiteSwitch({
  basePath,
  search,
  site,
}: {
  basePath: string;
  search: string;
  site: VatSite;
}) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
      <SiteLink basePath={basePath} search={search} current={site} value="hq" label="HQ" />
      <SiteLink basePath={basePath} search={search} current={site} value="syp" label="SYP" />
    </div>
  );
}
