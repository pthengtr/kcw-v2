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

  it("makes expense dashboards and search toolbars responsive", () => {
    const dashboard = read(
      "src/components/expense/dashboard/ExpenseDashboardPage.tsx"
    );
    expect(dashboard).toContain("grid-cols-1");
    expect(dashboard).toContain("lg:grid-cols-2");
    expect(dashboard).not.toContain("w-[1000px]");

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
});
