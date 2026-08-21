import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import {
  ADMIN_RBAC_PAGE,
  RBAC_PROTECTED_PAGE_KEYS,
  canonicalizePageKeys,
} from "@/lib/auth/rbac-pages";
import {
  getAuthUsersByIds,
  listAuthEmailToIdMap,
  resolveMemberIdsFromEmails,
} from "@/lib/auth/rbac-users";
import { createAdminClient } from "@/lib/supabase/admin";

const UpdateSchema = z.object({
  memberEmails: z.array(z.string().email()).optional().default([]),
  pageKeys: z.array(z.string()).optional().default([]),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roleKey: string }> }
) {
  const permCheck = await requirePermission(ADMIN_RBAC_PAGE);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const { roleKey } = await params;
  const supabase = createAdminClient();

  const [roleRes, membersRes, permsRes] = await Promise.all([
    supabase
      .from("kcw_roles")
      .select("role_key,title,description")
      .eq("role_key", roleKey)
      .maybeSingle(),
    supabase.from("kcw_user_roles").select("user_id").eq("role_key", roleKey),
    supabase
      .from("kcw_role_page_permissions")
      .select("page_key")
      .eq("role_key", roleKey),
  ]);

  if (roleRes.error) {
    return NextResponse.json(
      { error: "Unable to load role" },
      { status: 500 }
    );
  }

  if (membersRes.error) {
    return NextResponse.json(
      { error: "Unable to load members" },
      { status: 500 }
    );
  }

  if (permsRes.error) {
    return NextResponse.json(
      { error: "Unable to load page permissions" },
      { status: 500 }
    );
  }

  const memberIds = (membersRes.data ?? []).map((m) => m.user_id);
  const { users: filteredUsers, error: usersError } = await getAuthUsersByIds(
    supabase,
    memberIds
  );

  if (usersError) {
    return NextResponse.json({ error: usersError }, { status: 500 });
  }

  return NextResponse.json({
    role: roleRes.data ?? null,
    members: filteredUsers,
    pageKeys: canonicalizePageKeys(
      (permsRes.data ?? []).map((p) => p.page_key)
    ),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roleKey: string }> }
) {
  const permCheck = await requirePermission(ADMIN_RBAC_PAGE);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status }
    );
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { roleKey } = await params;
  const { memberEmails, pageKeys } = parsed.data;

  const allowedPageKeys = new Set(
    RBAC_PROTECTED_PAGE_KEYS.filter((k) => k !== ADMIN_RBAC_PAGE)
  );
  const normalizedPageKeys = canonicalizePageKeys(pageKeys).filter((k) =>
    allowedPageKeys.has(k)
  );

  const supabase = createAdminClient();

  // One small directory read is fine for ≤30 users when mapping emails → ids.
  const { emailToId, error: usersError } = await listAuthEmailToIdMap(supabase);

  if (usersError) {
    return NextResponse.json({ error: usersError }, { status: 500 });
  }

  const { memberIds, missingEmail } = resolveMemberIdsFromEmails(
    memberEmails,
    emailToId
  );
  if (missingEmail) {
    return NextResponse.json(
      { error: `User not found: ${missingEmail}` },
      { status: 400 }
    );
  }

  const { error: clearMembersError } = await supabase
    .from("kcw_user_roles")
    .delete()
    .eq("role_key", roleKey);

  if (clearMembersError) {
    return NextResponse.json(
      { error: "Unable to update members" },
      { status: 500 }
    );
  }

  if (memberIds.length > 0) {
    const { error: insertMembersError } = await supabase
      .from("kcw_user_roles")
      .insert(memberIds.map((id) => ({ user_id: id, role_key: roleKey })));
    if (insertMembersError) {
      return NextResponse.json(
        { error: "Unable to update members" },
        { status: 500 }
      );
    }
  }

  const { error: clearPermsError } = await supabase
    .from("kcw_role_page_permissions")
    .delete()
    .eq("role_key", roleKey);

  if (clearPermsError) {
    return NextResponse.json(
      { error: "Unable to update permissions" },
      { status: 500 }
    );
  }

  if (normalizedPageKeys.length > 0) {
    const { error: insertPermsError } = await supabase
      .from("kcw_role_page_permissions")
      .insert(
        normalizedPageKeys.map((pageKey) => ({
          role_key: roleKey,
          page_key: pageKey,
        }))
      );
    if (insertPermsError) {
      return NextResponse.json(
        { error: "Unable to update permissions" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    memberEmails,
    pageKeys: normalizedPageKeys,
  });
}
