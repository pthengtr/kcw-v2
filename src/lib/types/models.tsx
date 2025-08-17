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
  party_uuid: UUID;
  branch: BranchType;
  payment_method: PaymentMethodType;
  supplier: PartyOption;
  created_at: string;
  voucher_description: string;
  tax_exempt: number;
  doc_type: string;
  ref_receipt_uuid?: UUID | undefined;
  expense_receipt?: ExpenseReceiptType | undefined;
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
  temp_id: string;
  sku_uuid: string;
  sku_code?: string;
  product_name?: string;
  base_uom?: string;
  qty: number;
  unit_cost: number; // exclusive VAT (stored in DB)
  unit_cost_inc_tax: number; // inclusive VAT (UI only)
  line_discount_amount: number;
  effective_tax_rate: number;
};

export type LocationRow = {
  location_uuid: string;
  location_code: string;
  location_name: string;
  is_active: boolean;
};

export type SkuLookupRow = {
  sku_uuid: string;
  sku_code: string;
  uom_code: string; // base uom
  product: { product_name: string } | null;
};

export type BarcodeLookupRow = {
  barcode: string;
  sku: SkuLookupRow | null;
};

export type SkuBasic = {
  sku_uuid: string;
  sku_code: string;
  base_uom: string;
  product_name: string;
};

// types/tax-report.ts
export type TaxReportRow = {
  receipt_uuid: string;
  receipt_number: string; // already shortened to last 13 chars
  receipt_date: string; // ISO date string
  supplier_name: string | null;
  tax_payer_id: string | null;
  voucher_description: string | null;
  remark: string | null;
  total_amount: number;
  discount: number;
  tax_exempt: number;
  vat: number;
  total_before_tax: number;
  vat_only: number;
  total_after_tax: number;
  branch_uuid: string;
  created_at: string;
  total_count: number; // same value on every row in the page
};

export type PartyKind = "SUPPLIER" | "CUSTOMER" | "BOTH";

export type PartyTaxInfo = {
  tax_info_uuid: string;
  legal_name: string | undefined;
  tax_payer_id: string | undefined;
  address: string | undefined;
  created_at: string;
  updated_at: string;
};

export type PartyBankInfo = {
  bank_info_uuid: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string | undefined;
  account_type: "CHECKING" | "SAVINGS" | "OTHER";
  is_default: boolean;
};

export type PartyContact = {
  contact_uuid: string;
  contact_name: string;
  role_title: string | undefined;
  email: string | undefined;
  phone: string | undefined;
  is_primary: boolean;
};

export type PartyOption = {
  party_uuid: string;
  party_code: string;
  party_name: string;
  kind: PartyKind;
  tax_info: PartyTaxInfo[]; // FK: party_tax_info
  banks: PartyBankInfo[]; // FK: party_bank_info
  contacts: PartyContact[]; // FK: party_contact
};
