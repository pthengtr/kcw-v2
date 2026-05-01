import { ProductImageAdminScreen } from "./_components/product-image-admin-screen";
import {
  getProductByBcode,
  listProductImageSlots,
  normalizeBcode,
} from "./queries";

type ProductImagesSearchParams = {
  bcode?: string;
  error?: string;
  saved?: string;
  deleted?: string;
  slot?: string;
  mode?: string;
};

type PageProps = {
  searchParams?: Promise<ProductImagesSearchParams>;
};

export default async function ProductImagesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const bcode = normalizeBcode(params.bcode);

  const [product, slots] = bcode
    ? await Promise.all([
        getProductByBcode(bcode),
        listProductImageSlots(bcode),
      ])
    : [null, []];

  return (
    <ProductImageAdminScreen
      bcode={bcode}
      product={product}
      slots={slots}
      status={{
        error: params.error ?? "",
        saved: params.saved === "1",
        deleted: params.deleted === "1",
        slot: params.slot ?? "",
        mode: params.mode ?? "",
      }}
    />
  );
}
