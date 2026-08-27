"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  banWebookUserAction,
  unbanWebookUserAction,
  updateWebookUserAction,
} from "../../../app/admin/users/actions";
import type { WebookManagedUser } from "../../../server/repositories/webook-users";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { UserTable, type WebookUserAction } from "./user-table";

interface UserManagementPageProps {
  initialUsers: WebookManagedUser[];
}

interface EditDraft {
  name: string;
  username: string;
  email: string;
  tel: string;
}

const EMPTY_DRAFT: EditDraft = {
  name: "",
  username: "",
  email: "",
  tel: "",
};

type LifecycleAction = typeof banWebookUserAction | typeof unbanWebookUserAction;

export function UserManagementPage({ initialUsers }: UserManagementPageProps) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<WebookManagedUser | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(EMPTY_DRAFT);
  const [dialogError, setDialogError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function clearSelection(): void {
    setSelectedUser(null);
    setDraft(EMPTY_DRAFT);
    setDialogError("");
  }

  function handleMenuAction(action: WebookUserAction, user: WebookManagedUser): void {
    setSelectedUser(user);
    setDialogError("");
    setStatusMessage("");

    if (action === "edit") {
      setDraft({
        name: user.name,
        username: user.username,
        email: user.email,
        tel: user.tel,
      });
      setEditOpen(true);
      return;
    }

    if (action === "ban") {
      setBanOpen(true);
      return;
    }

    setUnbanOpen(true);
  }

  function closeEditDialog(): void {
    setEditOpen(false);
    clearSelection();
  }

  function submitEdit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!selectedUser) return;

    const data = new FormData();
    data.set("id", selectedUser.id);
    data.set("name", draft.name);
    data.set("username", draft.username);
    data.set("email", draft.email);
    data.set("tel", draft.tel);

    startTransition(async () => {
      try {
        const result = await updateWebookUserAction(data);
        if (!result.ok) {
          setDialogError(result.message);
          return;
        }

        setStatusMessage("บันทึกข้อมูลผู้ใช้แล้ว");
        setEditOpen(false);
        clearSelection();
        router.refresh();
      } catch {
        setDialogError("ไม่สามารถบันทึกข้อมูลผู้ใช้ได้ กรุณาลองใหม่");
      }
    });
  }

  function submitLifecycle(
    action: LifecycleAction,
    successMessage: string,
    fallbackMessage: string,
    closeDialog: () => void,
  ): void {
    if (!selectedUser) return;

    const data = new FormData();
    data.set("id", selectedUser.id);

    startTransition(async () => {
      try {
        const result = await action(data);
        if (!result.ok) {
          setDialogError(result.message);
          return;
        }

        setStatusMessage(successMessage);
        closeDialog();
        clearSelection();
        router.refresh();
      } catch {
        setDialogError(fallbackMessage);
      }
    });
  }

  function handleDialogOpenChange(open: boolean, closeDialog: () => void): void {
    if (open || isPending) return;
    closeDialog();
    clearSelection();
  }

  return (
    <main className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">จัดการผู้ใช้ Webook</h1>
        <p className="text-sm text-muted-foreground">
          แก้ไขข้อมูลและสถานะการใช้งานของผู้ใช้
        </p>
      </header>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {statusMessage}
        </p>
      ) : null}

      {initialUsers.length > 0 ? (
        <UserTable onAction={handleMenuAction} users={initialUsers} />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            ไม่พบผู้ใช้
          </CardContent>
        </Card>
      )}

      <Dialog
        onOpenChange={(open) => handleDialogOpenChange(open, () => setEditOpen(false))}
        open={editOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขผู้ใช้</DialogTitle>
            <DialogDescription>
              แก้ไขข้อมูลของ {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitEdit}>
            <div className="grid gap-1.5">
              <Label htmlFor="webook-user-name">ชื่อ</Label>
              <Input
                autoComplete="name"
                id="webook-user-name"
                maxLength={150}
                onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))}
                required
                value={draft.name}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="webook-user-username">Username</Label>
              <Input
                autoComplete="username"
                id="webook-user-username"
                maxLength={100}
                onChange={(event) => setDraft((value) => ({ ...value, username: event.target.value }))}
                value={draft.username}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="webook-user-email">อีเมล</Label>
              <Input
                autoComplete="email"
                id="webook-user-email"
                onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))}
                required
                type="email"
                value={draft.email}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="webook-user-tel">เบอร์โทร</Label>
              <Input
                autoComplete="tel"
                id="webook-user-tel"
                inputMode="tel"
                maxLength={30}
                onChange={(event) => setDraft((value) => ({ ...value, tel: event.target.value }))}
                value={draft.tel}
              />
            </div>
            {dialogError ? (
              <p className="text-sm text-destructive" role="alert">
                {dialogError}
              </p>
            ) : null}
            <DialogFooter>
              <Button disabled={isPending} onClick={closeEditDialog} type="button" variant="outline">
                ยกเลิก
              </Button>
              <Button disabled={isPending} type="submit">
                {isPending ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => handleDialogOpenChange(open, () => setBanOpen(false))}
        open={banOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการ Ban ผู้ใช้</DialogTitle>
            <DialogDescription>
              การ Ban จะระงับสิทธิ์เข้าใช้งานจนกว่าจะมีการปลด Ban
            </DialogDescription>
          </DialogHeader>
          {selectedUser ? (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{selectedUser.name || "ไม่ระบุชื่อ"}</p>
              <p className="break-all text-muted-foreground">{selectedUser.email}</p>
            </div>
          ) : null}
          {dialogError ? (
            <p className="text-sm text-destructive" role="alert">
              {dialogError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => handleDialogOpenChange(false, () => setBanOpen(false))}
              type="button"
              variant="outline"
            >
              ยกเลิก
            </Button>
            <Button
              disabled={isPending}
              onClick={() => submitLifecycle(
                banWebookUserAction,
                "Ban ผู้ใช้แล้ว",
                "ไม่สามารถ Ban ผู้ใช้ได้ กรุณาลองใหม่",
                () => setBanOpen(false),
              )}
              type="button"
              variant="destructive"
            >
              {isPending ? "กำลังดำเนินการ…" : "ยืนยัน Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => handleDialogOpenChange(open, () => setUnbanOpen(false))}
        open={unbanOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการปลด Ban ผู้ใช้</DialogTitle>
            <DialogDescription>
              ผู้ใช้จะกลับเข้าสู่ระบบได้หลังจากปลด Ban
            </DialogDescription>
          </DialogHeader>
          {selectedUser ? (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{selectedUser.name || "ไม่ระบุชื่อ"}</p>
              <p className="break-all text-muted-foreground">{selectedUser.email}</p>
            </div>
          ) : null}
          {dialogError ? (
            <p className="text-sm text-destructive" role="alert">
              {dialogError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => handleDialogOpenChange(false, () => setUnbanOpen(false))}
              type="button"
              variant="outline"
            >
              ยกเลิก
            </Button>
            <Button
              disabled={isPending}
              onClick={() => submitLifecycle(
                unbanWebookUserAction,
                "ปลด Ban ผู้ใช้แล้ว",
                "ไม่สามารถปลด Ban ผู้ใช้ได้ กรุณาลองใหม่",
                () => setUnbanOpen(false),
              )}
              type="button"
            >
              {isPending ? "กำลังดำเนินการ…" : "ยืนยันปลด Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
