"use client";

import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import type { ManagedUser, UserLifecycleAction } from "./types";

const ACTION_COPY: Record<
  Exclude<UserLifecycleAction, "create_user">,
  { title: string; description: string; confirm: string; destructive?: boolean }
> = {
  reissue_temporary_password: {
    title: "ออกรหัสผ่านชั่วคราวใหม่",
    description:
      "รหัสเดิมจะใช้ไม่ได้ และรหัสใหม่จะแสดงเพียงครั้งเดียวหลังบันทึกสำเร็จ",
    confirm: "ออกรหัสใหม่",
  },
  suspend_user: {
    title: "ระงับผู้ใช้",
    description: "ผู้ใช้นี้จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะเปิดใช้งานใหม่",
    confirm: "ยืนยันระงับ",
    destructive: true,
  },
  reactivate_user: {
    title: "เปิดใช้งานผู้ใช้",
    description:
      "ระบบจะเปิดใช้งานและออกรหัสผ่านชั่วคราวใหม่ซึ่งแสดงเพียงครั้งเดียว",
    confirm: "เปิดใช้งาน",
  },
};

export function UserActionDialog({
  action,
  user,
  isBusy,
  onOpenChange,
  onConfirm,
}: {
  action: Exclude<UserLifecycleAction, "create_user"> | null;
  user: ManagedUser | null;
  isBusy: boolean;
  onOpenChange(open: boolean): void;
  onConfirm(): void;
}) {
  if (!action || !user) return null;
  const copy = ACTION_COPY[action];
  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <p className="break-all rounded-md bg-muted p-3 text-sm font-medium">
          {user.email}
        </p>
        <DialogFooter>
          <Button
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            ยกเลิก
          </Button>
          <Button
            disabled={isBusy}
            onClick={onConfirm}
            type="button"
            variant={copy.destructive ? "destructive" : "default"}
          >
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
