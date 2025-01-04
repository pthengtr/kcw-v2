"use client";
import { UserType } from "@/components/user/UserColumns";
import UserDetail from "@/components/user/UserDetail";
import UserTable from "@/components/user/UserTable";
import { useState } from "react";

export default function User() {
  const [selectedUser, setSelectedUser] = useState<UserType>();
  return (
    <section className="grid grid-cols-2">
      <UserTable setSelectedUser={setSelectedUser} />
      <UserDetail currentUser={selectedUser} />
    </section>
  );
}
