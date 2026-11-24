import { BI_REPORTS } from "@/lib/bi/reports";
import { HOME_MENU_ITEMS } from "@/lib/home/menu";

export type SupportTargetSource = "kcw-api" | "kcw-v2" | "hq-data";
export type SupportRepo = "kcw-api" | "kcw-v2" | "hq-data";

export type SupportTarget = {
  source: SupportTargetSource;
  id: string;
  label: string;
  href?: string;
  repo: SupportRepo;
  codeRoots: string[];
  notes?: string;
  group: string;
};

/** HQ data-agent domains (no code PR — answer-only on hq-ubuntu-server). */
const HQ_DATA_TARGETS: SupportTarget[] = [
  {
    source: "hq-data",
    id: "all",
    label: "HQ Data Agent (ทุกแหล่ง)",
    repo: "hq-data",
    codeRoots: [],
    notes:
      "Ask agent on hq-ubuntu-server with access to Supabase, KSS PARTS9, kss-pc PARTS9, and kcw-analytic GDrive outputs.",
    group: "hq-data",
  },
  {
    source: "hq-data",
    id: "supabase",
    label: "Supabase",
    repo: "hq-data",
    codeRoots: [],
    notes: "Supabase Postgres / Storage / RPCs on project kcw.",
    group: "hq-data",
  },
  {
    source: "hq-data",
    id: "kss",
    label: "KSS · PARTS9 (HQ)",
    repo: "hq-data",
    codeRoots: [],
    notes: "HQ SQL Server PARTS9 via KSS (PARTS9_HQ_* / python_reader).",
    group: "hq-data",
  },
  {
    source: "hq-data",
    id: "kss-pc",
    label: "kss-pc · PARTS9 (SYP)",
    repo: "hq-data",
    codeRoots: [],
    notes: "SYP SQL Server PARTS9 via kss-pc (PARTS9_SYP_*).",
    group: "hq-data",
  },
  {
    source: "hq-data",
    id: "analytics-gdrive",
    label: "kcw-analytic · Google Drive",
    repo: "hq-data",
    codeRoots: ["/home/hqadmin/mnt/gdrive/KCW-Data/kcw_analytics"],
    notes:
      "Mounted analytic tree: 01_raw / 03_curated / 04_outputs under KCW-Data/kcw_analytics.",
    group: "hq-data",
  },
];

/**
 * Mirror of kcw-api `src/staff_shell/catalog.py` WEB_SERVICES + codeRoots,
 * plus LINE-only surfaces (bot / rich menu) that are not waffle web apps.
 */
const KCW_API_TARGETS: SupportTarget[] = [
  {
    source: "kcw-api",
    id: "line-bot",
    label: "LINE แชทบอท",
    repo: "kcw-api",
    codeRoots: [
      "src/bot/",
      "scripts/line_rich_menu/",
      "src/staff_shell/",
    ],
    notes:
      "KCW LINE OA chatbot: message handlers, Flex/staff shell menus, and rich-menu layout/deploy.",
    group: "kcw-api",
  },
  {
    source: "kcw-api",
    id: "stock-check",
    label: "เช็คสต็อก",
    href: "/stock-check/",
    repo: "kcw-api",
    codeRoots: ["src/stock_check/", "app/stock_check_app.py"],
    notes: "LINE/web stock check; HQ + SYP.",
    group: "kcw-api",
  },
  {
    source: "kcw-api",
    id: "companion",
    label: "ไทเกอร์เพย์",
    href: "/companion/",
    repo: "kcw-api",
    codeRoots: ["src/companion/", "src/tiger_pay/", "app/main.py"],
    notes: "Tiger Pay companion + LINE webhook; HQ-only.",
    group: "kcw-api",
  },
  {
    source: "kcw-api",
    id: "parts9-explorer",
    label: "ค้นหา PARTS9",
    href: "/parts9/",
    repo: "kcw-api",
    codeRoots: ["src/parts9_explorer/", "app/parts9_explorer_app.py"],
    notes: "PARTS9 explorer UI/API; HQ + SYP.",
    group: "kcw-api",
  },
  {
    source: "kcw-api",
    id: "transfer",
    label: "โอนสินค้า",
    href: "/transfer/",
    repo: "kcw-api",
    codeRoots: ["src/transfer/", "app/transfer_app.py"],
    notes: "HQ↔SYP transfer requests; HQ + SYP.",
    group: "kcw-api",
  },
  {
    source: "kcw-api",
    id: "hq-po",
    label: "สั่งซื้อ",
    href: "/hq-po/",
    repo: "kcw-api",
    codeRoots: ["src/hq_po/", "app/hq_po_app.py"],
    notes: "HQ purchase orders; HQ-only.",
    group: "kcw-api",
  },
  {
    source: "kcw-api",
    id: "hq-receive",
    label: "รับสินค้าเข้า",
    href: "/hq-receive/",
    repo: "kcw-api",
    codeRoots: ["src/hq_receive/", "app/hq_receive_app.py"],
    notes: "HQ goods receive + invoice AI; HQ-only.",
    group: "kcw-api",
  },
  {
    source: "kcw-api",
    id: "online-sale",
    label: "ขายออนไลน์",
    href: "/online-sale/",
    repo: "kcw-api",
    codeRoots: ["src/online_sale/", "app/online_sale_app.py"],
    notes: "Online sale / TAD print; HQ-only.",
    group: "kcw-api",
  },
  {
    source: "kcw-api",
    id: "pay-notes",
    label: "ชำระเจ้าหนี้",
    href: "/pay-notes/",
    repo: "kcw-api",
    codeRoots: ["src/pay_notes/", "app/pay_notes_app.py"],
    notes: "AP pay notes + proof uploads; HQ-only.",
    group: "kcw-api",
  },
  {
    source: "kcw-api",
    id: "receive-notes",
    label: "รับชำระลูกหนี้",
    href: "/receive-notes/",
    repo: "kcw-api",
    codeRoots: ["src/receive_notes/", "app/receive_notes_app.py"],
    notes: "AR receive notes + receipts; HQ-only.",
    group: "kcw-api",
  },
];

const KCW_V2_PAGE_ROOTS: Record<string, { codeRoots: string[]; notes?: string }> =
  {
    expense: {
      codeRoots: [
        "src/app/(root)/(expense)/",
        "src/components/expense/",
        "src/lib/expense/",
      ],
    },
    stockAudit: {
      codeRoots: [
        "src/app/(root)/stock-audit/",
        "src/app/api/stock-audit/",
        "src/lib/stock-audit/",
      ],
    },
    productImageKpi: {
      codeRoots: [
        "src/app/(root)/product-images/",
        "src/app/api/product-images/",
      ],
    },
    bankStatement: {
      codeRoots: [
        "src/app/(root)/bank-statement-sync/",
        "src/components/bank/",
        "src/lib/bank/",
        "src/app/api/bank/",
      ],
    },
    onlineStatements: {
      codeRoots: [
        "src/app/(root)/online-statements/",
        "src/app/api/online-statements/",
        "src/lib/online-statements/",
      ],
    },
    vatRegister: {
      codeRoots: [
        "src/app/(root)/vat-register/",
        "src/components/vat/",
        "src/lib/vat/",
        "src/app/api/vat/",
      ],
    },
    vatInventory: {
      codeRoots: [
        "src/app/(root)/vat-inventory/",
        "src/app/api/vat-inventory/",
      ],
    },
    tigerPay: {
      codeRoots: [
        "src/app/(root)/tiger-pay/",
        "src/components/bank/TigerPay",
        "src/app/api/bank/tiger-pay/",
      ],
    },
    party: {
      codeRoots: ["src/app/(root)/(party)/", "src/components/party/"],
    },
    relatedProducts: {
      codeRoots: ["src/app/(root)/product-related/", "src/lib/po/"],
    },
    productImages: {
      codeRoots: ["src/app/(root)/product-images/"],
    },
    faq: {
      codeRoots: ["src/app/(root)/kb/", "src/lib/kb/"],
    },
    bi: {
      codeRoots: ["src/app/(root)/bi/", "src/lib/bi/", "src/app/api/bi/"],
      notes: "BI hub; prefer a specific BI report target when possible.",
    },
    po: {
      codeRoots: ["src/app/(root)/po/", "src/lib/po/", "src/app/api/po/"],
    },
    adminRbac: {
      codeRoots: [
        "src/app/(root)/admin/rbac/",
        "src/components/rbac/",
        "src/lib/auth/",
      ],
    },
    support: {
      codeRoots: [
        "src/app/(root)/support/",
        "src/lib/support/",
        "src/app/api/support/",
      ],
    },
  };

function kcwV2PageTargets(): SupportTarget[] {
  const fromMenu: SupportTarget[] = Object.values(HOME_MENU_ITEMS).map(
    (item) => {
      const meta = KCW_V2_PAGE_ROOTS[item.key] ?? {
        codeRoots: [`src/app/(root)${item.href}/`],
      };
      return {
        source: "kcw-v2",
        id: item.key,
        label: item.label,
        href: item.href,
        repo: "kcw-v2",
        codeRoots: meta.codeRoots,
        notes: meta.notes ?? item.description,
        group: "kcw-v2",
      };
    }
  );

  const extras: SupportTarget[] = [
    {
      source: "kcw-v2",
      id: "po",
      label: "สถานะ PO",
      href: "/po",
      repo: "kcw-v2",
      codeRoots: KCW_V2_PAGE_ROOTS.po.codeRoots,
      notes: "PO status / sync UI",
      group: "kcw-v2",
    },
    {
      source: "kcw-v2",
      id: "adminRbac",
      label: "Admin RBAC",
      href: "/admin/rbac",
      repo: "kcw-v2",
      codeRoots: KCW_V2_PAGE_ROOTS.adminRbac.codeRoots,
      notes: "Role and page permission admin",
      group: "kcw-v2",
    },
    {
      source: "kcw-v2",
      id: "support",
      label: "Support / แจ้งปัญหา",
      href: "/support",
      repo: "kcw-v2",
      codeRoots: KCW_V2_PAGE_ROOTS.support.codeRoots,
      notes: "This support request system",
      group: "kcw-v2",
    },
  ];

  const biTargets: SupportTarget[] = BI_REPORTS.map((report) => ({
    source: "kcw-v2",
    id: `bi:${report.id}`,
    label: `BI · ${report.label}`,
    href: report.href,
    repo: "kcw-v2",
    codeRoots: [
      `src/app/(root)${report.href}/`,
      "src/lib/bi/",
      "src/app/api/bi/",
    ],
    notes: `BI report pageKey=${report.pageKey}`,
    group: "kcw-v2-bi",
  }));

  return [...fromMenu, ...extras, ...biTargets];
}

export const SUPPORT_TARGETS: SupportTarget[] = [
  ...KCW_API_TARGETS,
  ...kcwV2PageTargets(),
  ...HQ_DATA_TARGETS,
];

export function getSupportTarget(
  source: string,
  id: string
): SupportTarget | undefined {
  return SUPPORT_TARGETS.find((t) => t.source === source && t.id === id);
}

export function supportTargetKey(target: Pick<SupportTarget, "source" | "id">) {
  return `${target.source}:${target.id}`;
}

export function parseSupportTargetKey(
  key: string
): { source: SupportTargetSource; id: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const source = key.slice(0, idx);
  const id = key.slice(idx + 1);
  if (source !== "kcw-api" && source !== "kcw-v2" && source !== "hq-data") {
    return null;
  }
  if (!id) return null;
  return { source, id };
}

export type SupportTargetMeta = {
  href?: string;
  repo: SupportRepo;
  codeRoots: string[];
  notes?: string;
};

export function targetMetaSnapshot(target: SupportTarget): SupportTargetMeta {
  return {
    href: target.href,
    repo: target.repo,
    codeRoots: target.codeRoots,
    notes: target.notes,
  };
}
