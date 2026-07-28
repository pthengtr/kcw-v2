import { describe, expect, it, vi } from "vitest";

import {
  AUTH_USER_DIRECTORY_PAGE_SIZE,
  getAuthUsersByIds,
  listAuthEmailToIdMap,
  resolveMemberIdsFromEmails,
} from "./rbac-users";

describe("rbac-users", () => {
  it("uses a small Auth directory page size for this app", () => {
    expect(AUTH_USER_DIRECTORY_PAGE_SIZE).toBeLessThanOrEqual(50);
  });

  it("resolves known member ids with getUserById instead of listUsers", async () => {
    const getUserById = vi.fn(async (id: string) => ({
      data: { user: { id, email: `${id}@example.com` } },
      error: null,
    }));
    const listUsers = vi.fn();

    const supabase = {
      auth: {
        admin: { getUserById, listUsers },
      },
    };

    const { users, error } = await getAuthUsersByIds(supabase as never, [
      "u1",
      "u2",
      "u1",
    ]);

    expect(error).toBeNull();
    expect(users).toEqual([
      { id: "u1", email: "u1@example.com" },
      { id: "u2", email: "u2@example.com" },
    ]);
    expect(getUserById).toHaveBeenCalledTimes(2);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("maps emails from a single small listUsers call", async () => {
    const listUsers = vi.fn(async () => ({
      data: {
        users: [
          { id: "a", email: "Ada@Example.com" },
          { id: "b", email: "bob@example.com" },
        ],
      },
      error: null,
    }));

    const supabase = {
      auth: {
        admin: { listUsers },
      },
    };

    const { emailToId, error } = await listAuthEmailToIdMap(supabase as never);
    expect(error).toBeNull();
    expect(listUsers).toHaveBeenCalledWith({
      perPage: AUTH_USER_DIRECTORY_PAGE_SIZE,
      page: 1,
    });
    expect(emailToId.get("ada@example.com")).toBe("a");
    expect(emailToId.get("bob@example.com")).toBe("b");
  });

  it("reports missing emails when resolving members for save", () => {
    const emailToId = new Map([["ada@example.com", "a"]]);
    const ok = resolveMemberIdsFromEmails(["Ada@Example.com"], emailToId);
    expect(ok).toEqual({ memberIds: ["a"], missingEmail: null });

    const missing = resolveMemberIdsFromEmails(
      ["missing@example.com"],
      emailToId
    );
    expect(missing.missingEmail).toBe("missing@example.com");
  });
});
