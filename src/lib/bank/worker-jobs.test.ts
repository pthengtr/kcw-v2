import { describe, expect, it } from "vitest";

import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { canAccessStatementSync } from "@/lib/auth/client-permissions";
import {
  BANK_IMPORT_JOB_TYPE,
  BANK_WORKER_CANDIDATES,
} from "@/lib/bank/worker-jobs";

describe("Bank sync worker helpers", () => {
  it("uses bank_statement_import job type and either-PC workers", () => {
    expect(BANK_IMPORT_JOB_TYPE).toBe("bank_statement_import");
    expect(BANK_WORKER_CANDIDATES).toEqual(["HQ-PC", "SYP-PC"]);
  });
});

describe("Bank statement sync RBAC", () => {
  it("exposes bank_statement_sync page key", () => {
    expect(BANK_PAGE_KEYS.statementSync).toBe("bank_statement_sync");
    expect(canAccessStatementSync(["*"])).toBe(true);
    expect(canAccessStatementSync(["bank_statement_sync"])).toBe(true);
    expect(canAccessStatementSync(["po_status"])).toBe(false);
  });
});
