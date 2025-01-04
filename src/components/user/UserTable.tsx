"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { DataTable } from "../common/DataTable";
import { userColumns, userInitialVisibility, UserType } from "./UserColumns";

type UserTableType = { setSelectedUser: (user: UserType) => void };

export default function UserTable({ setSelectedUser }: UserTableType) {
  const [users, setUsers] = useState<UserType[]>();
  const [total, setTotal] = useState<number>();

  useEffect(() => {
    async function getUsers() {
      const supabase = createClient();

      const { data, error, count } = await supabase
        .from("employee")
        .select("*", { count: "exact" })
        .limit(100);

      if (error) console.log(error);
      if (data) setUsers(data);
      if (count) setTotal(count);
    }

    getUsers();
  }, []);

  return (
    <div className="w-full h-[90vh]">
      {!!users && (
        <DataTable
          columns={userColumns}
          data={users}
          total={total}
          setSelectedRow={setSelectedUser}
          initialState={{ columnVisibility: userInitialVisibility }}
        ></DataTable>
      )}
    </div>
  );
}
