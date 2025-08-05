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
};

export type PaymentMethodType = {
  payment_uuid: UUID;
  payment_description: string;
};
