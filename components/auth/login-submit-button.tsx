"use client";

import { useFormStatus } from "react-dom";
import { Button } from "../ui/button";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} aria-busy={pending}>
    {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
  </Button>;
}
