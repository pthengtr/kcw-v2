"use client";

import { ProductRelatedProvider } from "./ProductRelatedProvider";
import ProductRelatedScreen from "./ProductRelatedScreen";

export default function ProductRelatedPage() {
  return (
    <ProductRelatedProvider>
      <ProductRelatedScreen />
    </ProductRelatedProvider>
  );
}
