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
  legal_name: string | null;
  tax_payer_id: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type PartyBankInfo = {
  bank_info_uuid: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string | null;
  account_type: "CHECKING" | "SAVINGS" | "OTHER"; // DB enum; assume NOT NULL or default
  is_default: boolean;
};

export type PartyContact = {
  contact_uuid: string;
  contact_name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
};

export type PartyOption = {
  party_uuid: string;
  party_code: string | null; // <- allow null
  party_name: string;
  kind: PartyKind;
  tax_info: PartyTaxInfo[];
  banks: PartyBankInfo[];
  contacts: PartyContact[];
};

// payment_reminder.types.ts

/** Exact row shape returned by Supabase */
export type PaymentReminderRow = {
  created_at: string; // timestamptz (ISO string)
  note_id: string;
  bill_count: number;
  start_date: string; // timestamptz (ISO string)
  end_date: string; // timestamptz (ISO string)
  total_amount: number;
  user_id: string;
  last_modified: string; // timestamptz (ISO string)
  due_date: string; // timestamptz (ISO string)
  payment_date: string | null; // timestamptz (ISO string) | null
  kbiz_datetime: string | null; // timestamptz (ISO string) | null
  discount: number;
  remark: string | null;
  proof_of_payment: boolean | null; // default false (nullable per schema)
  bank_info_uuid: string | null;
  party_uuid: string | null;
  reminder_uuid: string; // PK, default gen_random_uuid()
};

/** Shape for inserting a new row */
export type PaymentReminderInsert = {
  // Required (NOT NULL, no default):
  created_at: string;
  note_id: string;
  bill_count: number;
  start_date: string;
  end_date: string;
  total_amount: number;
  user_id: string;
  last_modified: string;
  due_date: string;
  discount: number;

  // Optional / nullable:
  payment_date?: string | null;
  kbiz_datetime?: string | null;
  remark?: string | null;

  // Defaults / optional:
  proof_of_payment?: boolean | null; // defaults to false if omitted
  bank_info_uuid?: string | null;
  party_uuid?: string | null;
  reminder_uuid?: string; // generated if omitted
};

/** Shape for updating an existing row */
export type PaymentReminderUpdate = Partial<{
  created_at: string;
  supplier_code: string;
  note_id: string;
  bill_count: number;
  start_date: string;
  end_date: string;
  total_amount: number;
  user_id: string;
  last_modified: string;
  due_date: string;
  payment_date: string | null;
  kbiz_datetime: string | null;
  discount: number;
  remark: string | null;
  proof_of_payment: boolean | null;
  bank_info_uuid: string | null;
  party_uuid: string | null;
  reminder_uuid: string; // rarely updated
}>;
