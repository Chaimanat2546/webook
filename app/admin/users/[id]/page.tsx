import { ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updateWebookUserFormAction } from "../actions";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
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
  searchParams: Promise<{ error?: string; section?: string }>;
}) {
  const { id } = await params;
  const { error, section } = await searchParams;
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
        {error ? (
          <p className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {activeSection.key === "details" ? (
          <form action={updateWebookUserFormAction} className="max-w-lg space-y-4">
            <input name="id" type="hidden" value={user.id} />
            <input name="roleId" type="hidden" value={user.roleId ?? ""} />
            <input name="section" type="hidden" value={activeSection.key} />
            <div className="space-y-2">
              <Label htmlFor="webook-user-name">ชื่อ</Label>
              <Input
                autoComplete="name"
                defaultValue={user.name}
                id="webook-user-name"
                maxLength={150}
                name="name"
                required
              />
            </div>

            {user.roleId === null ? (
              <p className="text-sm text-muted-foreground">
                กรุณากำหนดสิทธิ์ผู้ใช้ก่อนแก้ไขข้อมูลผู้ใช้
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button asChild type="button" variant="outline">
                <Link href="/admin/users">ยกเลิก</Link>
              </Button>
              <Button disabled={user.roleId === null} type="submit">บันทึก</Button>
            </div>
          </form>
        ) : (
          <form action={updateWebookUserFormAction} className="max-w-lg space-y-4">
            <input name="id" type="hidden" value={user.id} />
            <input name="name" type="hidden" value={user.name} />
            <input name="section" type="hidden" value={activeSection.key} />
            <div className="space-y-2">
              <Label htmlFor="webook-user-role">สิทธิ์ผู้ใช้</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue={user.roleId === null ? "" : String(user.roleId)}
                id="webook-user-role"
                name="roleId"
                required
              >
                <option disabled value="">เลือกสิทธิ์ผู้ใช้</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button asChild type="button" variant="outline">
                <Link href="/admin/users">ยกเลิก</Link>
              </Button>
              <Button disabled={roles.length === 0} type="submit">บันทึก</Button>
            </div>
          </form>
        )}
      </UserWorkspaceShell>
    </div>
  );
}
