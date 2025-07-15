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
  submitError: string | undefined;
  setSubmitError: (error: string | undefined) => void;
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
  const [submitError, setSubmitError] = useState<string>();

  const value = {
    selectedRow,
    setSelectedRow,
    columnFilters,
    setColumnFilters,
    openCreateDialog,
    setOpenCreateDialog,
    openUpdateDialog,
    setOpenUpdateDialog,
    submitError,
    setSubmitError,
  };

  return (
    <ReminderContext.Provider value={value}>
      {children}
    </ReminderContext.Provider>
  );
}
