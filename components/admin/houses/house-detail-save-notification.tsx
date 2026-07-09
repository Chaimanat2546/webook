"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function HouseDetailSaveNotification({ title }: { title: string }) {
  useEffect(() => {
    toast.success(title);
  }, [title]);

  return null;
}
