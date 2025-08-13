// app/(sales)/pos/page.tsx
import PosHeader from "@/components/pos/PosHeader";
import PosCartTable from "@/components/pos/PosCartTable";
import PosPayments from "@/components/pos/PosPayments";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useContext, useRef, useState } from "react";
import { PosContext, PosContextType } from "@/components/pos/PosProvider";

function AddLineInput() {
  const { addLineByInput, setSubmitError } = useContext(
    PosContext
  ) as PosContextType;
  const [term, setTerm] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  async function onAdd() {
    if (!term.trim()) return;
    await addLineByInput(term);
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
        onKeyDown={(e) => e.key === "Enter" && onAdd()}
      />
      <Button onClick={onAdd}>เพิ่ม</Button>
    </div>
  );
}

import PosFooter from "@/components/pos/PosFooter";

export default function PosPage() {
  return (
    <section className="p-4 space-y-6 flex flex-col items-center gap-2">
      <PosHeader />
      <AddLineInput />
      <PosCartTable />
      <PosPayments />
      <PosFooter />
    </section>
  );
}
