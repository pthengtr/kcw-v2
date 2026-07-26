import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Webapp mobile layout", () => {
  it("uses a mobile sheet drawer for navbar navigation", () => {
    const navbar = read("src/components/nav/NavbarClient.tsx");
    expect(navbar).toContain("md:hidden");
    expect(navbar).toContain("SheetContent");
    expect(navbar).toContain("hidden md:flex");
    expect(navbar).toContain('aria-label="เปิดเมนู"');
  });

  it("keeps home/menu cards fluid on narrow screens", () => {
    const card = read("src/components/common/CardIcon.tsx");
    expect(card).toContain("w-full max-w-80");
    expect(card).toContain("sm:w-80");

    const home = read("src/app/(root)/home/page.tsx");
    expect(home).toContain("text-3xl");
    expect(home).toContain("sm:text-6xl");
  });

  it("stacks expense create/update panes under md", () => {
    const create = read("src/components/expense/create/ExpenseCreatePage.tsx");
    expect(create).toContain("flex-col");
    expect(create).toContain("md:flex-row");

    const update = read(
      "src/components/expense/update-receipt/ExpenseUpdatePage.tsx"
    );
    expect(update).toContain("md:flex-row");

    const form = read(
      "src/components/expense/create/ExpenseCreateReceiptForm/ExpenseCreateReceiptForm.tsx"
    );
    expect(form).toContain("grid-cols-1");
    expect(form).toContain("sm:grid-cols-2");
  });

  it("makes expense search toolbars responsive", () => {
    const search = read(
      "src/components/expense/manage/ExpenseReceiptSearchForm.tsx"
    );
    expect(search).toContain("flex-col");
    expect(search).toContain("sm:flex-row");
  });

  it("stacks party/user panes and fluid shared pickers", () => {
    const user = read("src/app/(root)/(user)/user/page.tsx");
    expect(user).toContain("grid-cols-1");
    expect(user).toContain("md:grid-cols-2");

    const party = read("src/components/party/PartyFormDialog.tsx");
    expect(party).toContain("grid-cols-1 gap-3 sm:grid-cols-2");
    expect(party).toContain("w-[calc(100vw-1.5rem)]");

    const sku = read("src/components/common/SKUSelect.tsx");
    expect(sku).toContain("w-[min(560px,calc(100vw-2rem))]");

    const location = read("src/components/common/LocationSelect.tsx");
    expect(location).toContain("w-[min(460px,calc(100vw-2rem))]");

    const pagination = read("src/components/common/DataTablePagination.tsx");
    expect(pagination).toContain("flex-col");
    expect(pagination).toContain("sm:flex-row");
  });

  it("declares an explicit viewport for mobile browsers", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("export const viewport");
    expect(layout).toContain('width: "device-width"');
  });

  it("keeps BI shell and sales overview usable on narrow screens", () => {
    const shell = read("src/components/bi/BiShell.tsx");
    expect(shell).toContain("md:hidden");
    expect(shell).toContain("hidden w-64 shrink-0 md:block");
    expect(shell).toContain('aria-label="เปิดรายการรายงาน"');
    expect(shell).toContain("SheetContent");

    const sales = read("src/components/bi/sales/SalesOverviewPage.tsx");
    expect(sales).toContain("grid-cols-1");
    expect(sales).toContain("sm:grid-cols-2");
    expect(sales).toContain("xl:grid-cols-4");
    expect(sales).not.toContain("w-[1000px]");
    expect(sales).not.toContain('"today"');
    expect(sales).not.toContain("VAT ที่เก็บได้");
    expect(sales).not.toContain("ออนไลน์ vs หน้าร้าน");
    expect(sales).toContain("เฉลี่ยบิลต่อวัน");
    expect(sales).toContain("SalesPeriodTable");
    expect(sales).toContain('value="month"');
    expect(sales).toContain('type="month"');

    const split = read("src/components/bi/sales/SalesSplitChart.tsx");
    expect(split).not.toContain("<Legend");
    expect(split).toContain("whitespace-nowrap");

    const products = read("src/components/bi/products/ProductOverviewPage.tsx");
    expect(products).toContain("grid-cols-1");
    expect(products).toContain("sm:grid-cols-3");
    expect(products).toContain("ProductRankTable");
    expect(products).toContain("ProductCategoryTable");
    expect(products).toContain("BiHighlightsCard");
    expect(products).not.toContain("บรรทัดบิล");
    expect(products).not.toContain("HQ / SYP / ออนไลน์");
    expect(products).not.toContain("w-[1000px]");

    const salesHighlights = read("src/components/bi/sales/SalesOverviewPage.tsx");
    expect(salesHighlights).toContain("BiHighlightsCard");
    expect(salesHighlights).toContain("buildSalesHighlights");
  });
});

