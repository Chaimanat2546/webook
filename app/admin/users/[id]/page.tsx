import { ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { UserEditForm } from "../../../../components/admin/user-management/user-edit-form";
import { UserTaskHeader } from "../../../../components/admin/user-management/user-task-header";
import { UserWorkspaceNavItem } from "../../../../components/admin/user-management/user-workspace-nav-item";
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

export default async function EditWebookUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section } = await searchParams;
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
        backHref="/admin/users"
        dvId={user.dvId}
        subtitle="จัดการข้อมูลผู้ใช้"
        title={displayUserTitle(user.name, user.username, user.email)}
      />

      <UserWorkspaceShell
        contentIcon={<ActiveSectionIcon aria-hidden />}
        contentTitle={activeSection.label}
        sidebar={(
          <nav aria-label="หมวดข้อมูลผู้ใช้" className="flex gap-2 overflow-x-auto p-2 lg:block lg:space-y-1 lg:overflow-visible">
            {USER_EDIT_SECTIONS.map((section) => {
              const SectionIcon = section.icon;
              return (
                <UserWorkspaceNavItem
                  active={section.key === activeSection.key}
                  href={`/admin/users/${encodeURIComponent(user.id)}${section.key === "permissions" ? "?section=permissions" : ""}`}
                  icon={<SectionIcon aria-hidden />}
                  key={section.key}
                  label={section.label}
                />
              );
            })}
          </nav>
        )}
        sidebarTitle="หมวดข้อมูล"
      >
        <UserEditForm key={`${activeSection.key}-${user.dvId ?? ""}`} roles={roles} section={activeSection.key} user={user} />
      </UserWorkspaceShell>
    </div>
  );
}
