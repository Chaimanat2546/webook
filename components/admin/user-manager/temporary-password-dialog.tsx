"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
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

export function TemporaryPasswordDialog({
  email,
  projectName,
  password,
  onAcknowledge,
}: {
  email: string | null;
  projectName: string | null;
  password: string | null;
  onAcknowledge(): void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  if (password === null) return null;

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password as string);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onAcknowledge();
      }}
      open
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>รหัสผ่านชั่วคราว</DialogTitle>
          <DialogDescription>
            รหัสสำหรับ {email ?? "ผู้ใช้ที่เลือก"}
            {projectName ? ` ใน ${projectName}` : ""} แสดงเพียงครั้งเดียว
            โปรดส่งผ่านช่องทางที่ปลอดภัย
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label="รหัสผ่านชั่วคราว"
          className="font-mono"
          readOnly
          value={password}
        />
        <p className="text-xs text-muted-foreground">
          เมื่อปิดหน้าต่างนี้จะไม่สามารถเรียกดูรหัสเดิมได้
          หากสูญหายต้องออกรหัสชั่วคราวใหม่
        </p>
        {copyFailed ? (
          <Alert variant="destructive">
            <AlertTitle>คัดลอกไม่สำเร็จ</AlertTitle>
            <AlertDescription>
              กรุณาเลือกรหัสด้านบนและคัดลอกด้วยตนเอง
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button onClick={copyPassword} type="button" variant="outline">
            {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </Button>
          <Button onClick={onAcknowledge} type="button">
            ฉันบันทึกรหัสแล้ว
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
