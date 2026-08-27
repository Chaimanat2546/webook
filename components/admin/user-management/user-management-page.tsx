"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateWebookUserAction } from "../../../app/admin/users/actions";
import type {
  WebookManagedRole,
  WebookManagedUser,
} from "../../../lib/webook-users";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { UserTable } from "./user-table";

export function UserManagementPage({
  initialUsers,
  roles,
}: {
  initialUsers: WebookManagedUser[];
  roles: WebookManagedRole[];
}) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<WebookManagedUser | null>(null);
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function openEditDialog(user: WebookManagedUser) {
    setSelectedUser(user);
    setName(user.name);
    setRoleId(user.roleId === null ? "" : String(user.roleId));
    setErrorMessage("");
  }

  function closeEditDialog() {
    if (pending) return;
    setSelectedUser(null);
    setErrorMessage("");
  }

  function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) return;

    const formData = new FormData();
    formData.set("id", selectedUser.id);
    formData.set("name", name);
    formData.set("roleId", roleId);
    setErrorMessage("");

    startTransition(async () => {
      const result = await updateWebookUserAction(formData);
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      setSelectedUser(null);
      toast.success("แก้ไขผู้ใช้แล้ว");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">จัดการผู้ใช้ Webook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          แก้ไขชื่อและ Role ของผู้ใช้ในระบบ Webook
        </p>
      </header>

      <UserTable onEdit={openEditDialog} roles={roles} users={initialUsers} />

      <Dialog
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
        open={selectedUser !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
            <DialogDescription>
              {selectedUser?.username || selectedUser?.email || "ผู้ใช้ที่เลือก"}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={submitEdit}>
            <div className="space-y-2">
              <Label htmlFor="webook-user-name">ชื่อ</Label>
              <Input
                autoComplete="name"
                disabled={pending}
                id="webook-user-name"
                maxLength={150}
                name="name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webook-user-role">Role</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pending}
                id="webook-user-role"
                name="roleId"
                onChange={(event) => setRoleId(event.target.value)}
                required
                value={roleId}
              >
                <option disabled value="">เลือก Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>

            {errorMessage ? (
              <p className="text-sm text-destructive" role="alert">{errorMessage}</p>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button disabled={pending} type="button" variant="outline">ยกเลิก</Button>
              </DialogClose>
              <Button disabled={pending || roles.length === 0} type="submit">
                {pending ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
