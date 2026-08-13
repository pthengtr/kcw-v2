export type ProductImageEventType =
  | "image_upload"
  | "image_replace"
  | "image_delete";

export type ProductImageSummary = {
  uploads: number;
  replaces: number;
  deletes: number;
  total_actions: number;
  unique_products: number;
};

export type ProductImageOperator = {
  line_user_id: string;
  display_name: string;
  uploads_today: number;
  replaces_today: number;
  deletes_today: number;
  total_today: number;
  unique_today: number;
  uploads: number;
  replaces: number;
  deletes: number;
  total_actions: number;
  unique_products: number;
};

export type ProductImageActivity = {
  created_at: string;
  display_name: string;
  line_user_id: string;
  event_type: ProductImageEventType | string;
  bcode: string;
  storage_path: string | null;
};

export type ProductImageKpi = {
  from: string;
  to: string;
  today: string;
  as_of: string;
  summary_today: ProductImageSummary;
  summary_range: ProductImageSummary;
  operators: ProductImageOperator[];
  activity: ProductImageActivity[];
};

export const PRODUCT_IMAGE_EVENT_META: {
  key: ProductImageEventType;
  label: string;
}[] = [
  { key: "image_upload", label: "อัปโหลด" },
  { key: "image_replace", label: "แทนที่" },
  { key: "image_delete", label: "ลบ" },
];

export function productImageEventLabel(eventType: string): string {
  return (
    PRODUCT_IMAGE_EVENT_META.find((m) => m.key === eventType)?.label ??
    eventType
  );
}
