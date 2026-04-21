"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const ProductRelatedPage = dynamic(
  () => import("@/components/product-related/ProductRelatedPage"),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    ),
  },
);

export default function Page() {
  return <ProductRelatedPage />;
}
