"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function UserSaveNotification() {
  useEffect(() => {
    toast.success("บันทึกข้อมูลผู้ใช้แล้ว");
  }, []);

  return null;
}

export function UserUpdateErrorNotification({ message }: { message: string }) {
  useEffect(() => {
    toast.error(message);
  }, [message]);

  return null;
}
