import Link from "next/link";
import { ArrowRightLeft, Wallet } from "lucide-react";

const LINKS = [
  {
    href: "/portal/bank-statement",
    label: "Bank Statement",
    description: "ดูรายการเดินบัญชี",
    icon: ArrowRightLeft,
  },
  {
    href: "/portal/online-statements",
    label: "เงินเข้าออนไลน์",
    description: "ดูยอดโอนเข้าบัญชี ออเดอร์ และบิล TAD",
    icon: Wallet,
  },
] as const;

export default function PortalHomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">รายการเดินบัญชี</h1>
        <p className="text-sm text-slate-600">ดูได้อย่างเดียว</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
            >
              <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block font-medium text-slate-900">{item.label}</span>
                <span className="mt-1 block text-sm text-slate-600">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
