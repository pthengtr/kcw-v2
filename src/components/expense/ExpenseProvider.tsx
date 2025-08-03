"use client";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useState,
} from "react";
import React from "react";
import { storageObjectType } from "../common/ImageCarousel";
import {
  ExpenseReceiptType,
  PaymentMethodType,
} from "./summary/ExpenseReceiptColumn";
import { ExpenseEntryType } from "./summary/ExpenseEntryColumn";
import { ExpenseItemType } from "./item/ExpenseItemColumn";
import { ExpenseCategoryType } from "./item/ExpenseCategoryColumn";
import { createClient } from "@/lib/supabase/client";
import { ColumnFiltersState } from "@tanstack/react-table";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { DefaultValues, useForm, UseFormReturn } from "react-hook-form";
import {
  ExpenseCreateReceiptFormDefaultType,
  expenseCreateReceiptFormDefaultValues,
  formSchema,
} from "./create/ExpenseCreateReceiptForm/ExpenseCreateReceiptForm";
import { SupplierType } from "../supplier/SupplierColumn";

export type ExpenseContextType = {
  openAddEntryDialog: boolean;
  setOpenAddEntryDialog: (open: boolean) => void;
  openUpdateEntryDialog: boolean;
  setOpenUpdateEntryDialog: (open: boolean) => void;
  openCreateVatReceiptDialog: boolean;
  setOpenCreateVatReceiptDialog: (open: boolean) => void;
  openCreateNoVatReceiptDialog: boolean;
  setOpenCreateNoVatReceiptDialog: (open: boolean) => void;
  openAddItemDialog: boolean;
  setOpenAddItemDialog: (open: boolean) => void;
  openUpdateItemDialog: boolean;
  setOpenUpdateItemDialog: (open: boolean) => void;
  openAddCategoryDialog: boolean;
  setOpenAddCategoryDialog: (open: boolean) => void;
  openUpdateCategoryDialog: boolean;
  setOpenUpdateCategoryDialog: (open: boolean) => void;

  submitError: string | undefined;
  setSubmitError: (error: string | undefined) => void;
  handleSelectedReceipt: (row: ExpenseReceiptType) => void;
  receiptImageArray: storageObjectType[] | undefined;
  setReceiptImageArray: (
    receiptImageArray: storageObjectType[] | undefined
  ) => void;
  getCategory: () => Promise<void>;
  getItems: () => Promise<void>;
  columnFilters: ColumnFiltersState | [];
  setColumnFilters: Dispatch<SetStateAction<ColumnFiltersState>>;
  createReceiptTab: string;
  setCreateReceiptTab: (createReceiptTab: string) => void;

  // set selected group
  selectedSupplier: SupplierType | undefined;
  setSelectedSupplier: (selectedRow: SupplierType | undefined) => void;
  selectedReceipt: ExpenseReceiptType | undefined;
  setSelectedReceipt: (selectedRow: ExpenseReceiptType | undefined) => void;
  selectedEntry: ExpenseEntryType | undefined;
  setSelectedEntry: (selectedRow: ExpenseEntryType | undefined) => void;
  selectedItem: ExpenseItemType | undefined;
  setSelectedItem: (selectedRow: ExpenseItemType | undefined) => void;
  selectedCategory: ExpenseCategoryType | undefined;
  setSelectedCategory: (
    selectedCategory: ExpenseCategoryType | undefined
  ) => void;
  selectedPaymentMethod: PaymentMethodType | undefined;
  setSelectedPaymentMethod: (
    selectedPaymentMethod: PaymentMethodType | undefined
  ) => void;

  // array group
  expenseReceipts: ExpenseReceiptType[];
  setExpenseReceipts: (expenses: ExpenseReceiptType[]) => void;
  receiptEntries: ExpenseEntryType[];
  setReceiptEntries: (receiptEntries: ExpenseEntryType[]) => void;
  expenseItems: ExpenseItemType[];
  setExpenseItems: (expenseItems: ExpenseItemType[]) => void;
  createEntries: ExpenseEntryType[];
  setCreateEntries: (createEntries: ExpenseEntryType[]) => void;
  expenseCategories: ExpenseCategoryType[];
  setExpenseCategories: (expenseCategories: ExpenseCategoryType[]) => void;

  // total group
  totalReceipt: number | undefined;
  setTotalReceipt: (total: number) => void;
  totalEntry: number | undefined;
  setTotalEntry: (total: number) => void;
  totalItem: number | undefined;
  setTotalItem: (total: number) => void;
  totalCategory: number | undefined;
  setTotalCategory: (total: number) => void;

  vatInput: string;
  setVatInput: (vatInput: string) => void;
  discountInput: string;
  setDiscountInput: (vatInput: string) => void;
  withholdingInput: string;
  setWithholdingInput: (vatInput: string) => void;
  formExpenseReceipt: UseFormReturn<ExpenseCreateReceiptFormDefaultType>;
  resetCreateReceiptForm: () => void;
  handleDeleteCreateEntry: (entry_id: number) => void;
};

export const ExpenseContext = createContext<ExpenseContextType | null>(null);

type ExpenseProviderProps = {
  children: React.ReactNode;
};

export default function ExpenseProvider({ children }: ExpenseProviderProps) {
  const [openAddEntryDialog, setOpenAddEntryDialog] = useState(false);
  const [openUpdateEntryDialog, setOpenUpdateEntryDialog] = useState(false);
  const [openCreateVatReceiptDialog, setOpenCreateVatReceiptDialog] =
    useState(false);
  const [openCreateNoVatReceiptDialog, setOpenCreateNoVatReceiptDialog] =
    useState(false);
  const [openAddItemDialog, setOpenAddItemDialog] = useState(false);
  const [openUpdateItemDialog, setOpenUpdateItemDialog] = useState(false);
  const [openAddCategoryDialog, setOpenAddCategoryDialog] = useState(false);
  const [openUpdateCategoryDialog, setOpenUpdateCategoryDialog] =
    useState(false);

  // select group
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseReceiptType>();
  const [selectedEntry, setSelectedEntry] = useState<ExpenseEntryType>();
  const [selectedItem, setSelectedItem] = useState<ExpenseItemType>();
  const [selectedCategory, setSelectedCategory] =
    useState<ExpenseCategoryType>();
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierType>();
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodType>();

  // array group
  const [expenseItems, setExpenseItems] = useState<ExpenseItemType[]>([]);
  const [expenseReceipts, setExpenseReceipts] = useState<ExpenseReceiptType[]>(
    []
  );
  const [receiptEntries, setReceiptEntries] = useState<ExpenseEntryType[]>([]);
  const [createEntries, setCreateEntries] = useState<ExpenseEntryType[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<
    ExpenseCategoryType[]
  >([]);
  // total group
  const [totalReceipt, setTotalReceipt] = useState<number>();
  const [totalEntry, setTotalEntry] = useState<number>();
  const [totalItem, setTotalItem] = useState<number>();
  const [totalCategory, setTotalCategory] = useState<number>();

  // image and misc
  const [receiptImageArray, setReceiptImageArray] =
    useState<storageObjectType[]>();
  const [submitError, setSubmitError] = useState<string>();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [createReceiptTab, setCreateReceiptTab] = useState("company");

  // for create receipt form
  const [vatInput, setVatInput] = useState("7");
  const [discountInput, setDiscountInput] = useState("0");
  const [withholdingInput, setWithholdingInput] = useState("0");

  const formExpenseReceipt = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues:
      expenseCreateReceiptFormDefaultValues as DefaultValues<ExpenseCreateReceiptFormDefaultType>,
  });

  function handleSelectedReceipt(row: ExpenseReceiptType) {
    setSelectedReceipt(row);
  }

  function resetCreateReceiptForm() {
    setSelectedSupplier(undefined);
    setCreateEntries([]);
    setVatInput("7");
    setDiscountInput("0");
    setWithholdingInput("0");
    setCreateReceiptTab("company");
  }

  function handleDeleteCreateEntry(entry_id: number) {
    const newCreateEntries = createEntries.filter(
      (item) => item.entry_id !== entry_id
    );
    setCreateEntries(newCreateEntries);
  }

  const supabase = createClient();

  const getCategory = useCallback(
    async function () {
      const query = supabase
        .from("expense_category")
        .select("*", { count: "exact" })
        .order("category_id", { ascending: false })
        .limit(500);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setExpenseCategories(data);
      }
      if (count) setTotalCategory(count);
    },
    [setExpenseCategories, setTotalCategory, supabase]
  );

  const getItems = useCallback(
    async function () {
      const query = supabase
        .from("expense_item")
        .select("*, expense_category(*)", { count: "exact" })
        .order("item_id", { ascending: false })
        .limit(500);

      const { data, error, count } = await query;

      if (error) {
        console.log(error);
        return;
      }

      if (data) {
        setExpenseItems(data);
      }
      if (count) setTotalItem(count);
    },
    [setExpenseItems, setTotalItem, supabase]
  );

  const value = {
    openAddEntryDialog,
    setOpenAddEntryDialog,
    openUpdateEntryDialog,
    setOpenUpdateEntryDialog,
    openCreateVatReceiptDialog,
    setOpenCreateVatReceiptDialog,
    openCreateNoVatReceiptDialog,
    setOpenCreateNoVatReceiptDialog,
    openAddItemDialog,
    setOpenAddItemDialog,
    openUpdateItemDialog,
    setOpenUpdateItemDialog,
    openAddCategoryDialog,
    setOpenAddCategoryDialog,
    openUpdateCategoryDialog,
    setOpenUpdateCategoryDialog,

    //selected group
    selectedReceipt,
    setSelectedReceipt,
    selectedEntry,
    setSelectedEntry,
    selectedItem,
    setSelectedItem,
    selectedCategory,
    setSelectedCategory,
    selectedSupplier,
    setSelectedSupplier,
    selectedPaymentMethod,
    setSelectedPaymentMethod,

    // array group
    expenseReceipts,
    setExpenseReceipts,
    receiptEntries,
    setReceiptEntries,
    expenseItems,
    setExpenseItems,
    createEntries,
    setCreateEntries,
    expenseCategories,
    setExpenseCategories,

    // total group
    totalReceipt,
    setTotalReceipt,
    totalItem,
    setTotalItem,
    totalEntry,
    setTotalEntry,
    totalCategory,
    setTotalCategory,

    // misc
    submitError,
    setSubmitError,
    receiptImageArray,
    setReceiptImageArray,
    handleSelectedReceipt,
    getCategory,
    getItems,
    columnFilters,
    setColumnFilters,
    createReceiptTab,
    setCreateReceiptTab,
    resetCreateReceiptForm,
    handleDeleteCreateEntry,

    vatInput,
    setVatInput,
    discountInput,
    setDiscountInput,
    withholdingInput,
    setWithholdingInput,
    formExpenseReceipt,
  };

  return (
    <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
  );
}
