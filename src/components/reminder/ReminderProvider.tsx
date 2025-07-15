"use client";
import { createContext, useState } from "react";
import React from "react";
import {
  ColumnFilter,
  ColumnFiltersState,
  OnChangeFn,
} from "@tanstack/react-table";
import { ReminderType } from "./ReminderColumn";

export type ReminderContextType = {
  selectedRow: ReminderType | undefined;
  setSelectedRow: (selectedRow: ReminderType) => void;
  columnFilters: ColumnFilter[] | undefined;
  setColumnFilters: OnChangeFn<ColumnFiltersState>;
  openCreateDialog: boolean;
  setOpenCreateDialog: (open: boolean) => void;
  openUpdateDialog: boolean;
  setOpenUpdateDialog: (open: boolean) => void;
};

export const ReminderContext = createContext<ReminderContextType | null>(null);

type ReminderProvider = {
  children: React.ReactNode;
};

export default function ReminderProvider({ children }: ReminderProvider) {
  const [selectedRow, setSelectedRow] = useState<ReminderType>();
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openUpdateDialog, setOpenUpdateDialog] = useState(false);

  const value = {
    selectedRow,
    setSelectedRow,
    columnFilters,
    setColumnFilters,
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    setOpenUpdateDialog,
  };

  return (
    <ReminderContext.Provider value={value}>
      {children}
    </ReminderContext.Provider>
  );
}
