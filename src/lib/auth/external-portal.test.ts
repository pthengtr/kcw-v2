import { describe, expect, it } from "vitest";

import {
  externalPortalAccess,
  isExternalPortalUser,
  loginDestination,
} from "./external-portal";

describe("external portal access", () => {
  it("treats external without admin as a portal user", () => {
    expect(isExternalPortalUser(["external"])).toBe(true);
    expect(isExternalPortalUser(["normal", "external"])).toBe(true);
    expect(isExternalPortalUser(["admin", "external"])).toBe(false);
    expect(isExternalPortalUser(["normal"])).toBe(false);
  });

  it("allows the portal and read APIs, and blocks writes", () => {
    expect(externalPortalAccess("/portal", "GET")).toBe("allow");
    expect(externalPortalAccess("/portal/bank-statement", "GET")).toBe("allow");
    expect(externalPortalAccess("/portal/online-statements", "POST")).toBe(
      "allow"
    );
    expect(externalPortalAccess("/api/auth/me/permissions", "GET")).toBe(
      "allow"
    );
    expect(
      externalPortalAccess("/api/bank/statement-lines", "GET")
    ).toBe("allow");
    expect(
      externalPortalAccess("/api/bank/statement-lines/abc", "PATCH")
    ).toBe("deny");
    expect(externalPortalAccess("/api/online-statements/upload", "POST")).toBe(
      "deny"
    );
    expect(externalPortalAccess("/api/online-statements/sync", "POST")).toBe(
      "deny"
    );
    expect(externalPortalAccess("/api/online-statements", "GET")).toBe("allow");
    expect(externalPortalAccess("/api/bank/import-files", "GET")).toBe("allow");
    expect(externalPortalAccess("/api/bank/tiger-pay/daily", "GET")).toBe(
      "deny"
    );
    expect(externalPortalAccess("/home", "GET")).toBe("redirect");
    expect(externalPortalAccess("/home", "POST")).toBe("deny");
  });

  it("sends external users to the portal and ignores other next paths", () => {
    expect(loginDestination(["external"], null)).toBe("/portal");
    expect(loginDestination(["normal", "external"], "/portal/bank-statement")).toBe(
      "/portal/bank-statement"
    );
    expect(loginDestination(["external"], "/home")).toBe("/portal");
    expect(loginDestination(["external"], "//evil.example")).toBe("/portal");
    expect(loginDestination(["external"], "/portal/../home")).toBe("/portal");
    expect(loginDestination(["admin"], "/portal")).toBe("/home");
    expect(loginDestination(["normal"], null)).toBe("/home");
  });
});
