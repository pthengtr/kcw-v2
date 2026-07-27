import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { ADMIN_RBAC_PAGE, RBAC_PROTECTED_PAGE_KEYS } from "@/lib/auth/rbac-pages";
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

  const { data: role, error: roleError } = await supabase
    .from("kcw_roles")
    .select("role_key,title,description")
    .eq("role_key", roleKey)
    .maybeSingle();

  if (roleError) {
    return NextResponse.json(
      { error: "Unable to load role" },
      { status: 500 }
    );
  }

  const { data: members, error: membersError } = await supabase
    .from("kcw_user_roles")
    .select("user_id")
    .eq("role_key", roleKey);

  if (membersError) {
    return NextResponse.json(
      { error: "Unable to load members" },
      { status: 500 }
    );
  }

  const memberIds = new Set((members ?? []).map((m) => m.user_id));

  const { data: allUsers, error: usersError } =
    await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 });

  if (usersError) {
    return NextResponse.json(
      { error: "Unable to load users" },
      { status: 500 }
    );
  }

  const filteredUsers = (allUsers?.users ?? [])
    .filter((u) => memberIds.has(u.id))
    .map((u) => ({ id: u.id, email: u.email }));

  const { data: perms, error: permsError } = await supabase
    .from("kcw_role_page_permissions")
    .select("page_key")
    .eq("role_key", roleKey);

  if (permsError) {
    return NextResponse.json(
      { error: "Unable to load page permissions" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    role: role ?? null,
    members: filteredUsers,
    pageKeys: (perms ?? []).map((p) => p.page_key),
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

  const allowedPageKeys = new Set(RBAC_PROTECTED_PAGE_KEYS.filter((k) => k !== ADMIN_RBAC_PAGE));
  const normalizedPageKeys = pageKeys.filter((k) => allowedPageKeys.has(k));

  const supabase = createAdminClient();

  const { data: allUsers, error: usersError } =
    await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 });

  if (usersError) {
    return NextResponse.json(
      { error: "Unable to resolve users" },
      { status: 500 }
    );
  }

  const emailToId = new Map(
    (allUsers?.users ?? [])
      .filter((u) => u.email)
      .map((u) => [u.email as string, u.id])
  );

  const memberIds: string[] = [];
  for (const email of memberEmails) {
    const id = emailToId.get(email);
    if (!id) {
      return NextResponse.json(
        { error: `User not found: ${email}` },
        { status: 400 }
      );
    }
    memberIds.push(id);
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
        normalizedPageKeys.map((pageKey) => ({ role_key: roleKey, page_key: pageKey }))
      );
    if (insertPermsError) {
      return NextResponse.json(
        { error: "Unable to update permissions" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, memberEmails, pageKeys: normalizedPageKeys });
}

