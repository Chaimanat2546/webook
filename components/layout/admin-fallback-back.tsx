"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";

export function AdminFallbackBack() {
  const pathname = usePathname();
  const root = ["/admin/houses", "/admin/quotations", "/admin/advertisements", "/admin/users", "/admin/user-manager"].find(path => pathname === path || pathname.startsWith(`${path}/`));
  return <Button asChild className="min-h-12 text-base md:min-h-0 md:text-sm" variant="outline"><Link href={root ?? "/login"}><ArrowLeft aria-hidden data-icon="inline-start" />{root ? "กลับหน้ารายการ" : "กลับหน้าเข้าสู่ระบบ"}</Link></Button>;
}
