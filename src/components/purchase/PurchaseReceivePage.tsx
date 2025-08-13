"use client";

import PurchaseHeader from "@/components/purchase/PurchaseHeader";
import AddLineInput from "@/components/purchase/AddLineInput";
import CartTable from "@/components/purchase/CartTable";
import PurchaseFooter from "@/components/purchase/PurchaseFooter";

export default function PurchaseReceivePage() {
  return (
    <div className="p-4 flex flex-col items-center gap-8">
      <h1 className="text-xl font-semibold">รับสินค้า (Purchase Receive)</h1>
      <PurchaseHeader />
      <AddLineInput />
      <CartTable />
      <PurchaseFooter />
    </div>
  );
}
