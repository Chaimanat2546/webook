import { ShieldX } from "lucide-react";
import Link from "next/link";
import { signOut } from "../../app/login/actions";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export function AdminNoAccess() {
  return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10"><Card className="w-full max-w-sm"><CardContent className="space-y-4 text-center"><ShieldX aria-hidden className="mx-auto size-10 text-muted-foreground" /><h1 className="text-xl font-semibold">บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน</h1><p className="text-sm text-muted-foreground">กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์การใช้งานให้บัญชีของคุณ</p><Button asChild variant="outline" className="min-h-11 w-full"><Link href="/admin/login-history">ดูประวัติการเข้าสู่ระบบของฉัน</Link></Button><form action={signOut}><Button type="submit" variant="outline" className="min-h-11 w-full">ออกจากระบบ</Button></form></CardContent></Card></main>;
}
