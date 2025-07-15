"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "../common/DataTableColumnHeader";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type UserType = {
  employeeId: string;
  salut: string;
  fullName: string;
  nationalId: string;
  nationality: string;
  position: string;
  address: string;
  dob: Date;
  phone: string;
  email: string;
  nickname: string;
  startDate: string;
};

export const userInitialVisibility = {
  รหัสพนักงาน: true,
  ชื่อพนักงาน: true,
  ชื่อเล่น: false,
};

export const userColumns: ColumnDef<UserType>[] = [
  {
    id: "รหัสพนักงาน",
    accessorKey: "employeeId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="รหัสพนักงาน" />
    ),
    filterFn: (row, columnId, filterValue) => {
      return (row.getValue(columnId) as number)
        .toString()
        .includes(filterValue);
    },
  },
  {
    id: "ชื่อพนักงาน",
    accessorKey: "fullName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ชื่อพนักงาน" />
    ),
  },
  {
    id: "ชื่อเล่น",
    accessorKey: "nickname",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ชื่อเล่น" />
    ),
  },
];
