"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ADMIN_RBAC_PAGE,
  RBAC_PROTECTED_PAGE_KEYS,
  ROLE_ADMIN,
  ROLE_NORMAL,
} from "@/lib/auth/rbac-pages";
import BackButton from "@/components/common/BackButton";
import TableLoadingState from "@/components/common/TableLoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RoleRow = {
  role_key: string;
  title: string;
  description: string | null;
};

type RoleDetail = {
  role: RoleRow | null;
  members: { id: string; email: string }[];
  pageKeys: string[];
};

const PAGE_KEY_LABELS: Record<string, string> = {
  admin_rbac: "Admin: จัดการ RBAC",
  bi_income: "BI: รายได้/กำไรขั้นต้น-สุทธิ",
  bi_income_statement: "BI: งบกำไรขาดทุน (VAT)",
  bi_sales: "BI: ภาพรวมยอดขาย",
  bi_sales_compare: "BI: เปรียบเทียบยอดขาย",
  bi_customers: "BI: อันดับลูกค้า",
  bi_products: "BI: อันดับสินค้า",
  bi_product_movement: "BI: การเคลื่อนไหวสินค้า",
  bi_expenses: "BI: ภาพรวมค่าใช้จ่าย",
  bi_cashflow: "BI: กระแสเงินสด (ธนาคาร)",
  bi_vat: "BI: ภาษีขาย / ภาษีซื้อ",
  bank_tiger_pay: "Bank: TigerPay",
  bank_statement_sync: "Bank: Statement Upload",
  po_status: "PO: สถานะใบสั่งซื้อ",
  stock_audit: "ตรวจนับสต็อก (Date Audit)",
};

const DEFAULT_ROLE_EMAILS: Record<string, string[]> = {
  [ROLE_ADMIN]: ["pthengtr@gmail.com", "narumon.wit@gmail.com"],
  [ROLE_NORMAL]: [],
};

function labelForPageKey(pageKey: string) {
  return PAGE_KEY_LABELS[pageKey] ?? pageKey;
}

export default function RbacAdminPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [roleKey, setRoleKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [memberEmailToAdd, setMemberEmailToAdd] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRoles() {
      setError(null);
      const res = await fetch("/api/admin/rbac/roles", { method: "GET" });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Unable to load roles");
        setLoadingDetail(false);
        return;
      }
      const nextRoles = json.roles ?? [];
      setRoles(nextRoles);
      setRoleKey((prev) => prev ?? nextRoles[0]?.role_key ?? null);
      if (!nextRoles.length) setLoadingDetail(false);
    }
    void loadRoles();
  }, []);

  useEffect(() => {
    async function loadDetail() {
      if (!roleKey) return;
      setLoadingDetail(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/rbac/roles/${roleKey}`, {
          method: "GET",
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error ?? "Unable to load role");
          return;
        }
        setDetail(json);
      } finally {
        setLoadingDetail(false);
      }
    }
    void loadDetail();
  }, [roleKey]);

  const protectedPageKeyChoices = useMemo(() => {
    return RBAC_PROTECTED_PAGE_KEYS.filter((k) => k !== ADMIN_RBAC_PAGE);
  }, []);

  const [selectedPageKeys, setSelectedPageKeys] = useState<string[]>([]);
  const [selectedMemberEmails, setSelectedMemberEmails] = useState<string[]>([]);

  useEffect(() => {
    if (!detail) return;
    setSelectedPageKeys(detail.pageKeys ?? []);
    const memberEmails = (detail.members ?? []).map((m) => m.email);
    setSelectedMemberEmails(
      Array.from(
        new Set([...(DEFAULT_ROLE_EMAILS[detail.role?.role_key ?? ""] ?? []), ...memberEmails])
      )
    );
  }, [detail]);

  function togglePageKey(pageKey: string, checked: boolean) {
    setSelectedPageKeys((prev) => {
      if (checked) return Array.from(new Set([...prev, pageKey]));
      return prev.filter((k) => k !== pageKey);
    });
  }

  function addMemberEmail() {
    const email = memberEmailToAdd.trim().toLowerCase();
    if (!email) return;
    if (selectedMemberEmails.includes(email)) return;
    setSelectedMemberEmails((prev) => [...prev, email]);
    setMemberEmailToAdd("");
  }

  function removeMemberEmail(email: string) {
    setSelectedMemberEmails((prev) => prev.filter((e) => e !== email));
  }

  async function save() {
    if (!roleKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rbac/roles/${roleKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memberEmails: selectedMemberEmails,
          pageKeys: selectedPageKeys,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Unable to save permissions");
        return;
      }
      await reloadDetail();
    } finally {
      setLoading(false);
    }
  }

  async function reloadDetail() {
    if (!roleKey) return;
    const res = await fetch(`/api/admin/rbac/roles/${roleKey}`, {
      method: "GET",
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Unable to reload role");
      return;
    }
    setDetail(json);
  }

  return (
    <div className="space-y-4 px-4 py-4 sm:px-8 sm:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <BackButton href="/home" />
          <div>
            <h1 className="text-xl font-bold">จัดการสิทธิ์การเข้าถึง</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              2 ชั้น: (1) ต้องมี role ถึงเข้าแอปได้ · (2) ใน role กำหนดหน้าได้ ·
              ผู้ใช้ใหม่ได้ normal อัตโนมัติ · admin เข้าได้ทุกหน้า
            </p>
          </div>
        </div>
        <div className="w-full sm:w-72">
          <Select value={roleKey ?? undefined} onValueChange={setRoleKey}>
            <SelectTrigger>
              <SelectValue placeholder="เลือก role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.role_key} value={r.role_key}>
                  {r.title ?? r.role_key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">สิทธิ์เข้าใช้งานหน้า</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingDetail ? (
              <TableLoadingState />
            ) : (
              protectedPageKeyChoices.map((k) => {
                const checked = selectedPageKeys.includes(k);
                return (
                  <div key={k} className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => togglePageKey(k, v === true)}
                      id={`page-${k}`}
                    />
                    <label
                      htmlFor={`page-${k}`}
                      className="text-sm text-slate-800 leading-tight"
                    >
                      {labelForPageKey(k)}
                    </label>
                  </div>
                );
              })
            )}
          </CardContent>
          <CardContent className="pt-0">
            <Button
              type="button"
              disabled={loading || loadingDetail}
              onClick={() => void save()}
            >
              {loading ? "กำลังบันทึก..." : "บันทึกสิทธิ์"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">สมาชิกของ role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={memberEmailToAdd}
                placeholder="เพิ่มด้วยอีเมล (auth user)"
                onChange={(e) => setMemberEmailToAdd(e.target.value)}
                className="flex-1"
                disabled={loadingDetail}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addMemberEmail}
                disabled={loadingDetail}
              >
                เพิ่ม
              </Button>
            </div>

            <div className="max-h-64 space-y-2 overflow-auto pr-2">
              {loadingDetail ? (
                <TableLoadingState />
              ) : selectedMemberEmails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  ไม่มีสมาชิกใน role นี้
                </p>
              ) : (
                selectedMemberEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200/80 px-2 py-1.5"
                  >
                    <div className="min-w-0 truncate text-sm">{email}</div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeMemberEmail(email)}
                    >
                      ลบ
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

