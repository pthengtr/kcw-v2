"use client";
import BackButton from "@/components/common/BackButton";
import { UserType } from "@/components/user/UserColumns";
import UserDetail from "@/components/user/UserDetail";
import UserTable from "@/components/user/UserTable";
import { useState } from "react";

export default function User() {
  const [selectedUser, setSelectedUser] = useState<UserType>();
  return (
    <section className="space-y-4 p-2 md:p-4">
      <div className="flex items-center gap-3">
        <BackButton href="/home" />
        <h2 className="text-xl font-bold sm:text-2xl">ผู้ใช้งาน</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-0">
        <UserTable setSelectedUser={setSelectedUser} />
        <UserDetail currentUser={selectedUser} />
      </div>
    </section>
  );
}
