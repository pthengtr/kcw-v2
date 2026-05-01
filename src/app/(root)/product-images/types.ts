export type ProductInfo = {
  BCODE: string;
  DESCR: string | null;
  MODEL: string | null;
  BRAND: string | null;
  PRICE1?: number | null;
};

export type ProductImageSlot = {
  slotNo: number;
  label: string;
  filename: string;
  path: string;
  exists: boolean;
  publicUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  size: number | null;
  isOldest: boolean;
};
