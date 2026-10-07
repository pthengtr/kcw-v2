"use client";

import { useState, type MouseEvent } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

const PRINT_ATTR = "data-dialog-print";
const STYLE_ID = "dialog-print-style";

const PRINT_CSS = `
@media print {
  @page { margin: 12mm; size: auto; }
  html, body {
    height: auto !important;
    overflow: visible !important;
    background: white !important;
  }
  body > *:not([${PRINT_ATTR}]):not(:has([${PRINT_ATTR}])) {
    display: none !important;
  }
  body > :has([${PRINT_ATTR}]) {
    position: static !important;
    display: block !important;
    height: auto !important;
    overflow: visible !important;
  }
  :has(> [${PRINT_ATTR}]) > :not([${PRINT_ATTR}]) {
    display: none !important;
  }
  [${PRINT_ATTR}] {
    position: static !important;
    inset: auto !important;
    left: auto !important;
    top: auto !important;
    right: auto !important;
    width: 100% !important;
    max-width: none !important;
    max-height: none !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    transform: none !important;
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    background: white !important;
    color: #111 !important;
    overflow: visible !important;
    display: block !important;
  }
  [${PRINT_ATTR}] > button {
    display: none !important;
  }
  [${PRINT_ATTR}] .min-h-0,
  [${PRINT_ATTR}] [class*="overflow-"] {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
    min-height: 0 !important;
    flex: none !important;
  }
  [${PRINT_ATTR}] .sticky {
    position: static !important;
  }
  [${PRINT_ATTR}] .text-muted-foreground {
    color: #52525b !important;
  }
  [${PRINT_ATTR}] table {
    min-width: 0 !important;
  }
  [${PRINT_ATTR}] li,
  [${PRINT_ATTR}] tr {
    break-inside: avoid;
  }
}
`;

function ensurePrintStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
}

export default function DialogPrintButton({
  disabled = false,
  documentTitle,
}: {
  disabled?: boolean;
  documentTitle?: string;
}) {
  const [busy, setBusy] = useState(false);

  function handlePrint(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const root = event.currentTarget.closest("[role='dialog']");
    if (!(root instanceof HTMLElement)) return;

    ensurePrintStyle();
    const previousTitle = document.title;
    root.setAttribute(PRINT_ATTR, "");
    if (documentTitle?.trim()) document.title = documentTitle.trim();
    setBusy(true);

    const cleanup = () => {
      root.removeAttribute(PRINT_ATTR);
      document.title = previousTitle;
      setBusy(false);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => {
      try {
        window.print();
      } catch {
        cleanup();
      }
    }, 50);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-fit print:hidden"
      disabled={disabled || busy}
      onClick={handlePrint}
    >
      <Printer className="h-4 w-4" />
      พิมพ์
    </Button>
  );
}
