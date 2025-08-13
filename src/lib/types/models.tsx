export type UUID = string;

export type ExpenseReceiptType = {
  receipt_uuid: UUID;
  total_amount: number;
  remark: string;
  user_id: string;
  receipt_number: string;
  receipt_date: string;
  vat: number;
  withholding: number;
  discount: number;
  branch_uuid: UUID;
  payment_uuid: UUID;
  supplier_uuid: UUID;
  branch: BranchType;
  payment_method: PaymentMethodType;
  supplier: SupplierType;
  created_at: string;
  voucher_description: string;
  tax_exempt: number;
};

export type ExpenseEntryType = {
  entry_uuid: UUID;
  unit_price: number;
  quantity: number;
  entry_amount: number;
  entry_detail: string;
  discount: number;
  receipt_uuid: UUID;
  item_uuid: UUID;
  expense_item: ExpenseItemType;
  expense_receipt?: ExpenseReceiptType;
};

export type ExpenseItemType = {
  item_uuid: UUID;
  item_name: string;
  category_uuid: UUID;
  expense_category: ExpenseCategoryType;
};

export type ExpenseCategoryType = {
  category_uuid: UUID;
  category_name: string;
};

export type BranchType = {
  branch_uuid: UUID;
  branch_name: string;
};

export type SupplierType = {
  supplier_uuid: UUID;
  supplier_code: string;
  supplier_name: string;
  supplier_tax_info?: SupplierTaxInfoType;
};

export type SupplierTaxInfoType = {
  supplier_tax_info_uuid: UUID;
  supplier_uuid: UUID;
  address: string;
  tax_payer_id: string;
};

export type PaymentMethodType = {
  payment_uuid: UUID;
  payment_description: string;
  voucher_type: string;
};

export type ExtendedExpenseReceiptType = ExpenseReceiptType & {
  voucherId: string;
  totalNet: number;
};

export type ExpenseGeneralType = {
  general_uuid: UUID;
  created_at: Date;
  payment_uuid: UUID;
  branch_uuid: UUID;
  item_uuid: UUID;
  entry_date: string;
  description: string;
  unit_price: number;
  quantity: number;
  remark: string;
  payment_method: PaymentMethodType;
  branch: BranchType;
  expense_item: ExpenseItemType;
};

export type SkuCatalogRowType = {
  sku_uuid: string;
  sku_code: string;
  product_name: string;
  base_uom: string;
  primary_barcode: string | null;
  price_ui1: number | string | null;
  price_ui2_pack: number | string | null;
  price_ui2: number | string | null;
  on_hand_total: number | string | null;
};

export type PriceRow = {
  sku_uuid: string;
  pack_uom_code: string;
  qty_per_pack: number | string;
  unit_price: number | string;
};

export type StockRow = {
  sku_uuid: string;
  sku_code: string;
  base_uom: string;
  location_uuid: string | null;
  location_code: string | null;
  on_hand: number | string | null;
};

// components/purchase/types.ts
export type PurchaseLineDraft = {
  temp_id: string; // client-only id
  sku_uuid: string;
  sku_code: string;
  product_name: string;
  base_uom: string;
  qty: number;
  unit_cost: number;
  line_total: number;
};

export type LocationRow = {
  location_uuid: string;
  location_code: string;
  location_name: string;
  is_active: boolean;
};
