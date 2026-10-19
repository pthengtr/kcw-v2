"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { forwardRef, useEffect, useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { VatSite } from "@/lib/vat/inventory";
import { cn } from "@/lib/utils";

function PendingMark({ force }: { force: boolean }) {
  const { pending } = useLinkStatus();
  if (!pending && !force) return null;
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-current" aria-hidden />;
}

export const PendingLink = forwardRef<
  HTMLAnchorElement,
  Omit<ComponentProps<typeof Link>, "href"> & {
    href: string;
    resetKey: string;
    active?: boolean;
  }
>(function PendingLink({ href, resetKey, active = false, className, children, onClick, ...rest }, ref) {
  const [clicked, setClicked] = useState(false);
  useEffect(() => {
    setClicked(false);
  }, [resetKey]);

  return (
    <Link
      ref={ref}
      href={href}
      className={className}
      aria-current={active ? "page" : undefined}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || active) return;
        setClicked(true);
      }}
    >
      <PendingMark force={clicked && !active} />
      {children}
    </Link>
  );
});

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
  const resetKey = `${site}|${year}|${search}`;
  const sites: { value: VatSite; label: string }[] = [
    { value: "all", label: "ทั้งหมด" },
    { value: "hq", label: "HQ" },
    { value: "syp", label: "SYP" },
  ];
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
      {sites.map((item) => (
        <PendingLink
          key={item.value}
          href={hrefFor(basePath, search, site, year, { site: item.value })}
          active={site === item.value}
          resetKey={resetKey}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium",
            site === item.value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
          )}
        >
          {item.label}
        </PendingLink>
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
  const resetKey = `${site}|${year}|${search}`;
  return (
    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
      {years.map((item) => (
        <PendingLink
          key={item}
          href={hrefFor(basePath, search, site, year, { year: item })}
          active={year === item}
          resetKey={resetKey}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium",
            year === item ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
          )}
        >
          {item + 543}
        </PendingLink>
      ))}
    </div>
  );
}

export function VatInventorySearchButton({ resetKey }: { resetKey: string }) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  useEffect(() => {
    setClicked(false);
  }, [resetKey]);
  const show = pending || clicked;
  return (
    <Button type="submit" disabled={show} onClick={() => setClicked(true)}>
      {show ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      ค้นหา
    </Button>
  );
}
