"use client";

import { useState } from "react";

import { Button } from "../../ui/button";
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

export function CreateUserDialog({
  open,
  isBusy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  isBusy: boolean;
  onOpenChange(open: boolean): void;
  onSubmit(email: string): void;
}) {
  const [email, setEmail] = useState("");

  function updateOpen(nextOpen: boolean) {
    if (!nextOpen) setEmail("");
    onOpenChange(nextOpen);
  }

  return (
    <Dialog onOpenChange={updateOpen} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>สร้างผู้ดูแลระบบ</DialogTitle>
          <DialogDescription>
            ระบุอีเมลเท่านั้น ระบบจะสร้างรหัสผ่านชั่วคราวแบบใช้ครั้งเดียว
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const normalized = email.trim().toLowerCase();
            if (normalized) onSubmit(normalized);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="central-user-email">อีเมล</Label>
            <Input
              autoComplete="off"
              id="central-user-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={isBusy}
              onClick={() => updateOpen(false)}
              type="button"
              variant="outline"
            >
              ยกเลิก
            </Button>
            <Button disabled={isBusy || !email.trim()} type="submit">
              สร้างผู้ใช้
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
