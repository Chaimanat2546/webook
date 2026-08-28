import Link from "next/link";
import { notFound } from "next/navigation";

import { updateWebookUserFormAction } from "../actions";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { requireWebookUserManagerAdmin } from "../../../../server/auth/admin";
import {
  getWebookUserForManagement,
  listWebookUserManagementData,
} from "../../../../server/services/webook-users";

export default async function EditWebookUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  await requireWebookUserManagerAdmin();
  const [user, { roles }] = await Promise.all([
    getWebookUserForManagement(id),
    listWebookUserManagementData(),
  ]);

  if (!user) notFound();

  return (
    <div className="max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">แก้ไขผู้ใช้</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.username || user.email || "ผู้ใช้ Webook"}
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <form action={updateWebookUserFormAction} className="space-y-4 rounded-md border p-4">
        <input name="id" type="hidden" value={user.id} />
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

        <div className="space-y-2">
          <Label htmlFor="webook-user-role">Role</Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            defaultValue={user.roleId === null ? "" : String(user.roleId)}
            id="webook-user-role"
            name="roleId"
            required
          >
            <option disabled value="">เลือก Role</option>
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
    </div>
  );
}
