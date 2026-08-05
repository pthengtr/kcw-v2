import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardList,
  Grid3X3,
  Handshake,
  Images,
  Link2,
  MessageCircleWarning,
  Star,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

type MenuItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  iconSurfaceClassName: string;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const menuItems = {
  reminder: {
    href: "/reminder",
    label: "เตือนโอน",
    description: "ติดตามรายการและกำหนดการโอนเงิน",
    icon: MessageCircleWarning,
    iconClassName: "text-amber-600",
    iconSurfaceClassName: "bg-amber-50 ring-amber-100",
  },
  expense: {
    href: "/expense",
    label: "ค่าใช้จ่าย",
    description: "บันทึกและตรวจสอบค่าใช้จ่าย",
    icon: Banknote,
    iconClassName: "text-emerald-600",
    iconSurfaceClassName: "bg-emerald-50 ring-emerald-100",
  },
  po: {
    href: "/po",
    label: "ใบสั่งซื้อ (PO)",
    description: "ตรวจสอบสถานะใบสั่งซื้อ",
    icon: ClipboardList,
    iconClassName: "text-violet-600",
    iconSurfaceClassName: "bg-violet-50 ring-violet-100",
  },
  stockAudit: {
    href: "/stock-audit",
    label: "ตรวจนับสต็อก",
    description: "ติดตามความครบถ้วนของการตรวจนับ",
    icon: Boxes,
    iconClassName: "text-sky-600",
    iconSurfaceClassName: "bg-sky-50 ring-sky-100",
  },
  bankStatement: {
    href: "/bank-statement-sync",
    label: "Bank Statement",
    description: "นำเข้าและจับคู่รายการเดินบัญชี",
    icon: ArrowRightLeft,
    iconClassName: "text-blue-600",
    iconSurfaceClassName: "bg-blue-50 ring-blue-100",
  },
  tigerPay: {
    href: "/tiger-pay",
    label: "Tiger Pay",
    description: "ตรวจสอบธุรกรรมและการรับชำระ",
    icon: Wallet,
    iconClassName: "text-orange-600",
    iconSurfaceClassName: "bg-orange-50 ring-orange-100",
  },
  party: {
    href: "/party",
    label: "รายชื่อคู่ค้า",
    description: "ดูแลข้อมูลลูกค้าและผู้ขาย",
    icon: Handshake,
    iconClassName: "text-indigo-600",
    iconSurfaceClassName: "bg-indigo-50 ring-indigo-100",
  },
  relatedProducts: {
    href: "/product-related",
    label: "สินค้าที่ซื้อด้วยกัน",
    description: "ค้นหาความสัมพันธ์ระหว่างสินค้า",
    icon: Link2,
    iconClassName: "text-fuchsia-600",
    iconSurfaceClassName: "bg-fuchsia-50 ring-fuchsia-100",
  },
  productImages: {
    href: "/product-images",
    label: "จัดการรูปสินค้า",
    description: "ซิงก์และตรวจสอบรูปภาพสินค้า",
    icon: Images,
    iconClassName: "text-rose-600",
    iconSurfaceClassName: "bg-rose-50 ring-rose-100",
  },
  faq: {
    href: "/kb",
    label: "จัดการ FAQ",
    description: "ดูแลคลังความรู้สำหรับทีม",
    icon: BookOpen,
    iconClassName: "text-teal-600",
    iconSurfaceClassName: "bg-teal-50 ring-teal-100",
  },
  bi: {
    href: "/bi/income",
    label: "รายงาน BI",
    description: "ดูภาพรวมและวิเคราะห์ข้อมูลธุรกิจ",
    icon: BarChart3,
    iconClassName: "text-blue-600",
    iconSurfaceClassName: "bg-blue-50 ring-blue-100",
  },
} satisfies Record<string, MenuItem>;

const favoriteItems = [
  menuItems.reminder,
  menuItems.expense,
  menuItems.po,
  menuItems.bi,
  menuItems.bankStatement,
];

const menuGroups: MenuGroup[] = [
  {
    title: "งานประจำวัน",
    items: [menuItems.reminder, menuItems.expense, menuItems.po],
  },
  {
    title: "การเงินและรับชำระ",
    items: [menuItems.bankStatement, menuItems.tigerPay],
  },
  {
    title: "ข้อมูลและสินค้า",
    items: [
      menuItems.party,
      menuItems.relatedProducts,
      menuItems.productImages,
      menuItems.stockAudit,
    ],
  },
  {
    title: "รายงานและความรู้",
    items: [menuItems.bi, menuItems.faq],
  },
];

function FavoriteCard({ item }: { item: MenuItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      className="group flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-5 text-center shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <span
        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${item.iconSurfaceClassName}`}
      >
        <Icon
          className={`h-5 w-5 ${item.iconClassName}`}
          strokeWidth={1.8}
          aria-hidden
        />
      </span>
      <span className="text-sm font-semibold text-slate-700 transition-colors group-hover:text-blue-700">
        {item.label}
      </span>
    </Link>
  );
}

function MenuGroupCard({ group }: { group: MenuGroup }) {
  return (
    <section
      className="h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
      aria-labelledby={`group-${group.title}`}
    >
      <h3
        id={`group-${group.title}`}
        className="text-sm font-bold text-slate-900"
      >
        {group.title}
      </h3>
      <div className="mt-3 divide-y divide-slate-100">
        {group.items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 py-3 outline-none first:pt-1 last:pb-0 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${item.iconSurfaceClassName}`}
              >
                <Icon
                  className={`h-4 w-4 ${item.iconClassName}`}
                  strokeWidth={1.8}
                  aria-hidden
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-700 transition-colors group-hover:text-blue-700">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">
                  {item.description}
                </span>
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function getDisplayName(metadata: Record<string, unknown> | undefined) {
  const candidate = [
    metadata?.display_name,
    metadata?.full_name,
    metadata?.name,
  ].find((value): value is string => typeof value === "string" && !!value.trim());

  return candidate?.trim();
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const displayName = getDisplayName(
    user?.user_metadata as Record<string, unknown> | undefined
  );
  const totalTools = Object.keys(menuItems).length;
  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-slate-50/70">
      <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              สวัสดี{displayName ? `, ${displayName}` : ""} 👋
            </h1>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              จัดการงานของคุณได้อย่างง่ายและรวดเร็ว
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm">
            <Grid3X3 className="h-4 w-4 text-blue-600" aria-hidden />
            KCW Workspace
          </div>
        </header>

        <section className="mt-8" aria-labelledby="favorite-menu">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
              <h2
                id="favorite-menu"
                className="text-base font-bold text-slate-900 sm:text-lg"
              >
                เมนูโปรด
              </h2>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {favoriteItems.length} เมนู
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {favoriteItems.map((item) => (
              <FavoriteCard key={item.href} item={item} />
            ))}
          </div>
        </section>

        <section className="mt-8" aria-labelledby="workspace-summary">
          <h2
            id="workspace-summary"
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            ภาพรวมพื้นที่ทำงาน
          </h2>
          <div className="mt-3 grid grid-cols-1 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-6 py-5 text-center">
              <p className="text-xs font-medium text-slate-500">
                เครื่องมือทั้งหมด
              </p>
              <p className="mt-1 text-3xl font-bold text-blue-600">
                {totalTools}
                <span className="ml-1.5 text-xs font-medium text-slate-500">
                  รายการ
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">พร้อมให้คุณใช้งาน</p>
            </div>
            <div className="px-6 py-5 text-center">
              <p className="text-xs font-medium text-slate-500">หมวดงาน</p>
              <p className="mt-1 text-3xl font-bold text-violet-600">
                {menuGroups.length}
                <span className="ml-1.5 text-xs font-medium text-slate-500">
                  หมวด
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                แบ่งตามลักษณะการทำงาน
              </p>
            </div>
            <div className="px-6 py-5 text-center">
              <p className="text-xs font-medium text-slate-500">เมนูด่วน</p>
              <p className="mt-1 text-3xl font-bold text-amber-500">
                {favoriteItems.length}
                <span className="ml-1.5 text-xs font-medium text-slate-500">
                  รายการ
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">เข้าถึงได้จากด้านบน</p>
            </div>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="all-tools">
          <h2
            id="all-tools"
            className="text-base font-bold text-slate-900 sm:text-lg"
          >
            เครื่องมือทั้งหมด
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {menuGroups.map((group) => (
              <MenuGroupCard key={group.title} group={group} />
            ))}
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
          © {currentYear} KCW. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
