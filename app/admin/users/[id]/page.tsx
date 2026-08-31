import { ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { UserEditForm } from "../../../../components/admin/user-management/user-edit-form";
import { UserTaskHeader } from "../../../../components/admin/user-management/user-task-header";
import { UserWorkspaceSectionNav } from "../../../../components/admin/user-management/user-workspace-section-nav";
import { UserWorkspaceShell } from "../../../../components/admin/user-management/user-workspace-shell";
import { requireWebookUserManagerAdmin } from "../../../../server/auth/admin";
import {
  getWebookUserForManagement,
  listWebookUserManagementData,
} from "../../../../server/services/webook-users";

const USER_EDIT_SECTIONS = [
  { key: "details", label: "ข้อมูลผู้ใช้", icon: UserRoundIcon },
  { key: "permissions", label: "สิทธิ์และการใช้งาน", icon: ShieldCheckIcon },
] as const;

function displayUserTitle(...values: string[]): string {
  return values.find((value) => value && value.toLowerCase() !== "null") ?? "ผู้ใช้ Webook";
}

function normalizeReturnTo(value: string | undefined): string {
  if (!value) return "/admin/users";

  try {
    const target = new URL(value, "https://webook.local");
    return target.pathname === "/admin/users" ? `${target.pathname}${target.search}` : "/admin/users";
  } catch {
    return "/admin/users";
  }
}

export default async function EditWebookUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; section?: string }>;
}) {
  const { id } = await params;
  const { returnTo: requestedReturnTo, section } = await searchParams;
  const returnTo = normalizeReturnTo(requestedReturnTo);
  await requireWebookUserManagerAdmin();
  const [user, { roles }] = await Promise.all([
    getWebookUserForManagement(id),
    listWebookUserManagementData(),
  ]);

  if (!user) notFound();

  const activeSection = section === "permissions" ? USER_EDIT_SECTIONS[1] : USER_EDIT_SECTIONS[0];
  const ActiveSectionIcon = activeSection.icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:gap-5">
      <UserTaskHeader
        backHref={returnTo}
        dvId={user.dvId}
        subtitle="จัดการข้อมูลผู้ใช้"
        title={displayUserTitle(user.name, user.username, user.email)}
      />

      <UserWorkspaceShell
        contentIcon={<ActiveSectionIcon aria-hidden />}
        contentTitle={activeSection.label}
        sidebar={(
          <UserWorkspaceSectionNav
            returnTo={returnTo}
            selectedSection={activeSection.key}
            userId={user.id}
          />
        )}
        sidebarTitle="หมวดข้อมูล"
      >
        <UserEditForm key={`${activeSection.key}-${user.dvId ?? ""}`} roles={roles} section={activeSection.key} user={user} />
      </UserWorkspaceShell>
    </div>
  );
}
