import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Handshake,
  Images,
  Link2,
  MessageCircleWarning,
  PackageSearch,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";

type WorkspaceItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  iconSurfaceClassName: string;
};

type WorkspaceSection = {
  title: string;
  description: string;
  icon: LucideIcon;
  items: WorkspaceItem[];
};

const sections: WorkspaceSection[] = [
  {
    title: "งานประจำวัน",
    description: "ติดตามงานที่ต้องจัดการและดำเนินการในแต่ละวัน",
    icon: ClipboardCheck,
    items: [
      {
        href: "/reminder",
        label: "เตือนโอน",
        description: "ติดตามรายการและกำหนดการโอนเงิน",
        icon: MessageCircleWarning,
        iconClassName: "text-amber-700",
        iconSurfaceClassName: "bg-amber-50 ring-amber-100",
      },
      {
        href: "/expense",
        label: "ค่าใช้จ่าย",
        description: "บันทึก ตรวจสอบ และจัดการค่าใช้จ่าย",
        icon: Banknote,
        iconClassName: "text-emerald-700",
        iconSurfaceClassName: "bg-emerald-50 ring-emerald-100",
      },
      {
        href: "/po",
        label: "ใบสั่งซื้อ (PO)",
        description: "ตรวจสอบสถานะใบสั่งซื้อแต่ละสาขา",
        icon: ClipboardList,
        iconClassName: "text-violet-700",
        iconSurfaceClassName: "bg-violet-50 ring-violet-100",
      },
      {
        href: "/stock-audit",
        label: "ตรวจนับสต็อก",
        description: "ติดตามความครบถ้วนของการตรวจนับสินค้า",
        icon: Boxes,
        iconClassName: "text-cyan-700",
        iconSurfaceClassName: "bg-cyan-50 ring-cyan-100",
      },
    ],
  },
  {
    title: "การเงินและรับชำระ",
    description: "ตรวจสอบรายการธนาคารและช่องทางรับชำระ",
    icon: Wallet,
    items: [
      {
        href: "/bank-statement-sync",
        label: "Bank Statement",
        description: "นำเข้าและจับคู่รายการเดินบัญชีธนาคาร",
        icon: ArrowRightLeft,
        iconClassName: "text-blue-700",
        iconSurfaceClassName: "bg-blue-50 ring-blue-100",
      },
      {
        href: "/tiger-pay",
        label: "Tiger Pay",
        description: "ตรวจสอบธุรกรรมและสถานะการรับชำระ",
        icon: Wallet,
        iconClassName: "text-indigo-700",
        iconSurfaceClassName: "bg-indigo-50 ring-indigo-100",
      },
    ],
  },
  {
    title: "ข้อมูลและสินค้า",
    description: "ดูแลข้อมูลกลางและเครื่องมือที่เกี่ยวข้องกับสินค้า",
    icon: PackageSearch,
    items: [
      {
        href: "/party",
        label: "รายชื่อคู่ค้า",
        description: "จัดการข้อมูลลูกค้า ผู้ขาย และข้อมูลติดต่อ",
        icon: Handshake,
        iconClassName: "text-orange-700",
        iconSurfaceClassName: "bg-orange-50 ring-orange-100",
      },
      {
        href: "/product-related",
        label: "สินค้าที่ซื้อด้วยกัน",
        description: "ค้นหาความสัมพันธ์ระหว่างสินค้า",
        icon: Link2,
        iconClassName: "text-fuchsia-700",
        iconSurfaceClassName: "bg-fuchsia-50 ring-fuchsia-100",
      },
      {
        href: "/product-images",
        label: "จัดการรูปสินค้า",
        description: "ซิงก์และตรวจสอบรูปภาพสินค้า",
        icon: Images,
        iconClassName: "text-rose-700",
        iconSurfaceClassName: "bg-rose-50 ring-rose-100",
      },
      {
        href: "/kb",
        label: "จัดการ FAQ",
        description: "รวบรวมและดูแลคลังความรู้สำหรับทีม",
        icon: BookOpen,
        iconClassName: "text-teal-700",
        iconSurfaceClassName: "bg-teal-50 ring-teal-100",
      },
    ],
  },
];

function WorkspaceCard({ item }: { item: WorkspaceItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group relative flex min-h-36 flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm outline-none transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ${item.iconSurfaceClassName}`}
        >
          <Icon
            className={`h-5 w-5 ${item.iconClassName}`}
            strokeWidth={1.8}
            aria-hidden
          />
        </span>
        <ArrowRight
          className="h-4 w-4 text-slate-300 transition duration-200 group-hover:translate-x-0.5 group-hover:text-blue-600"
          aria-hidden
        />
      </div>
      <div className="mt-5">
        <h3 className="font-semibold text-slate-950 transition-colors group-hover:text-blue-700">
          {item.label}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">
          {item.description}
        </p>
      </div>
    </Link>
  );
}

function WorkspaceSection({ section }: { section: WorkspaceSection }) {
  const SectionIcon = section.icon;

  return (
    <section aria-labelledby={`section-${section.title}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
          <SectionIcon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <h2
            id={`section-${section.title}`}
            className="text-lg font-bold tracking-tight text-slate-950"
          >
            {section.title}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {section.items.map((item) => (
          <WorkspaceCard key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-50">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.08),_transparent_34%)]"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-300/30 sm:px-8 sm:py-9 lg:px-10">
          <div
            className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-32 right-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl"
            aria-hidden
          />

          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_25rem]">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold tracking-[0.14em] text-blue-100">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                KCW WORKSPACE
              </div>
              <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                จัดการงานทุกส่วน
                <span className="block text-blue-300">ได้จากที่เดียว</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                เลือกเครื่องมือที่ต้องการ
                เพื่อเริ่มทำงานและเข้าถึงข้อมูลของแต่ละฝ่ายได้อย่างรวดเร็ว
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                เข้าถึงด่วน
              </p>
              <div className="mt-3 grid gap-2">
                <Link
                  href="/reminder"
                  className="group flex items-center gap-3 rounded-xl bg-white/[0.07] px-3.5 py-3 transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  <MessageCircleWarning
                    className="h-4 w-4 text-amber-300"
                    aria-hidden
                  />
                  <span className="flex-1 text-sm font-medium">เตือนโอน</span>
                  <ArrowRight
                    className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white"
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/expense"
                  className="group flex items-center gap-3 rounded-xl bg-white/[0.07] px-3.5 py-3 transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                >
                  <Banknote className="h-4 w-4 text-emerald-300" aria-hidden />
                  <span className="flex-1 text-sm font-medium">ค่าใช้จ่าย</span>
                  <ArrowRight
                    className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white"
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/bi/income"
                  className="group flex items-center gap-3 rounded-xl bg-blue-500 px-3.5 py-3 transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                >
                  <BarChart3 className="h-4 w-4 text-white" aria-hidden />
                  <span className="flex-1 text-sm font-semibold">
                    ดูรายงาน BI
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-blue-100 transition group-hover:translate-x-0.5 group-hover:text-white"
                    aria-hidden
                  />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-9 space-y-10 sm:mt-12 sm:space-y-12">
          {sections.map((section) => (
            <WorkspaceSection key={section.title} section={section} />
          ))}

          <section
            aria-labelledby="section-analytics"
            className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 shadow-sm sm:p-8"
          >
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                  <BarChart3 className="h-6 w-6" strokeWidth={1.8} aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-blue-700">
                    BUSINESS INTELLIGENCE
                  </p>
                  <h2
                    id="section-analytics"
                    className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"
                  >
                    รายงานภาพรวมธุรกิจ
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    ติดตามรายได้ ยอดขาย ลูกค้า สินค้า
                    และค่าใช้จ่ายจากรายงานในที่เดียว
                  </p>
                </div>
              </div>
              <Link
                href="/bi/income"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                เปิดรายงาน BI
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>
        </div>

        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          KCW Internal Workspace
        </footer>
      </div>
    </main>
  );
}
