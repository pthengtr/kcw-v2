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
import { ExpenseReceiptType } from "./summary/ExpenseReceiptColumn";
import { ExpenseEntryType } from "./summary/ExpenseEntryColumn";
import { ExpenseItemType } from "./item/ExpenseItemColumn";
import { ExpenseCategoryType } from "./item/ExpenseCategoryColumn";
import { createClient } from "@/lib/supabase/client";
import { ColumnFiltersState } from "@tanstack/react-table";

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

  // set selected group
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

  // array group
  expenseReceipts: ExpenseReceiptType[] | undefined;
  setExpenseReceipts: (expenses: ExpenseReceiptType[]) => void;
  receiptEntries: ExpenseEntryType[] | undefined;
  setReceiptEntries: (receiptEntries: ExpenseEntryType[] | undefined) => void;
  expenseItems: ExpenseItemType[] | undefined;
  setExpenseItems: (expenseItems: ExpenseItemType[] | undefined) => void;
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

  // array group
  const [expenseItems, setExpenseItems] = useState<ExpenseItemType[]>();
  const [expenseReceipts, setExpenseReceipts] =
    useState<ExpenseReceiptType[]>();
  const [receiptEntries, setReceiptEntries] = useState<ExpenseEntryType[]>();
  const [createEntries, setCreateEntries] = useState<ExpenseEntryType[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<
    ExpenseCategoryType[]
  >([]);
  // total group
  const [totalReceipt, setTotalReceipt] = useState<number>();
  const [totalEntry, setTotalEntry] = useState<number>();
  const [totalItem, setTotalItem] = useState<number>();
  const [totalCategory, setTotalCategory] = useState<number>();
  // image
  const [receiptImageArray, setReceiptImageArray] =
    useState<storageObjectType[]>();
  const [submitError, setSubmitError] = useState<string>();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  function handleSelectedReceipt(row: ExpenseReceiptType) {
    setSelectedReceipt(row);
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

    submitError,
    setSubmitError,
    receiptImageArray,
    setReceiptImageArray,
    handleSelectedReceipt,
    getCategory,
    getItems,
    columnFilters,
    setColumnFilters,
  };

  return (
    <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
  );
}
