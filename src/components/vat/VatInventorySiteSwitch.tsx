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

function QueryLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
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

function hrefFor(
  basePath: string,
  search: string,
  site: VatSite,
  year: number,
  next: { site?: VatSite; year?: number }
): string {
  const params = new URLSearchParams();
  params.set("site", next.site ?? site);
  params.set("year", String(next.year ?? year));
  if (search) params.set("q", search);
  return `${basePath}?${params.toString()}`;
}

export function VatInventorySiteSwitch({
  basePath,
  search,
  site,
  year,
}: {
  basePath: string;
  search: string;
  site: VatSite;
  year: number;
}) {
  const sites: { value: VatSite; label: string }[] = [
    { value: "all", label: "ทั้งหมด" },
    { value: "hq", label: "HQ" },
    { value: "syp", label: "SYP" },
  ];
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
      {sites.map((item) => (
        <QueryLink
          key={item.value}
          href={hrefFor(basePath, search, site, year, { site: item.value })}
          active={site === item.value}
          label={item.label}
        />
      ))}
    </div>
  );
}

export function VatInventoryYearSwitch({
  basePath,
  search,
  site,
  year,
  years,
}: {
  basePath: string;
  search: string;
  site: VatSite;
  year: number;
  years: number[];
}) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
      {years.map((item) => (
        <QueryLink
          key={item}
          href={hrefFor(basePath, search, site, year, { year: item })}
          active={year === item}
          label={String(item + 543)}
        />
      ))}
    </div>
  );
}
