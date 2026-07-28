import type { SupabaseClient } from "@supabase/supabase-js";

/** App is expected to stay small; keep Auth directory page sized to that. */
export const AUTH_USER_DIRECTORY_PAGE_SIZE = 50;

export type RbacAuthUser = {
  id: string;
  email: string;
};

type AuthAdminClient = Pick<SupabaseClient, "auth">;

/**
 * Resolve emails for known Auth user ids (role members).
 * Prefer this over listing the whole directory when ids are already known.
 */
export async function getAuthUsersByIds(
  supabase: AuthAdminClient,
  userIds: string[]
): Promise<{ users: RbacAuthUser[]; error: string | null }> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { users: [], error: null };
  }

  const results = await Promise.all(
    uniqueIds.map(async (id) => {
      const { data, error } = await supabase.auth.admin.getUserById(id);
      if (error || !data.user?.email) return null;
      return { id: data.user.id, email: data.user.email };
    })
  );

  // Skip ids that no longer exist in Auth (stale membership rows).
  const users = results.filter((u): u is RbacAuthUser => u !== null);
  return { users, error: null };
}

/**
 * Build email → id map from the small Auth directory.
 * Appropriate when the app has a few dozen users and save needs email lookup.
 */
export async function listAuthEmailToIdMap(
  supabase: AuthAdminClient
): Promise<{ emailToId: Map<string, string>; error: string | null }> {
  const { data, error } = await supabase.auth.admin.listUsers({
    perPage: AUTH_USER_DIRECTORY_PAGE_SIZE,
    page: 1,
  });

  if (error) {
    return { emailToId: new Map(), error: "Unable to resolve users" };
  }

  const emailToId = new Map<string, string>();
  for (const user of data?.users ?? []) {
    if (!user.email) continue;
    emailToId.set(user.email.trim().toLowerCase(), user.id);
  }

  return { emailToId, error: null };
}

export function resolveMemberIdsFromEmails(
  emails: string[],
  emailToId: Map<string, string>
): { memberIds: string[]; missingEmail: string | null } {
  const memberIds: string[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    const id = emailToId.get(email);
    if (!id) {
      return { memberIds: [], missingEmail: email };
    }
    memberIds.push(id);
  }
  return { memberIds, missingEmail: null };
}
