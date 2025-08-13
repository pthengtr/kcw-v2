// components/purchase/AddLineInput.tsx
"use client";

import { useContext, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PurchaseContext, PurchaseContextType } from "./PurchaseProvider";
import { Loader2, ScanLine } from "lucide-react";

export default function AddLineInput() {
  const { addLineByInput, setSubmitError } = useContext(
    PurchaseContext
  ) as PurchaseContextType;
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function onAdd() {
    if (!term.trim()) return;
    setLoading(true);
    await addLineByInput(term);
    setLoading(false);
    setTerm("");
    setSubmitError(undefined);
    ref.current?.focus();
  }

  return (
    <div className="flex gap-2">
      <Input
        ref={ref}
        placeholder="สแกนบาร์โค้ด หรือพิมพ์รหัส SKU"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onAdd();
        }}
      />
      <Button onClick={onAdd} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <ScanLine />}
      </Button>
    </div>
  );
}
