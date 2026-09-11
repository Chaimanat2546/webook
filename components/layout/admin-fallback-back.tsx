"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";

export function AdminFallbackBack() {
  const pathname = usePathname();
  const root = ["/admin/houses", "/admin/quotations", "/admin/advertisements", "/admin/users", "/admin/user-manager"].find(path => pathname === path || pathname.startsWith(`${path}/`));
  return <Button asChild variant="outline"><Link href={root ?? "/login"}>{root ? "กลับหน้ารายการ" : "กลับหน้าเข้าสู่ระบบ"}</Link></Button>;
}
