import { ImagesIcon, LogOutIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "../../app/login/actions";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";

function HouseLink() {
  return (
    <Button asChild className="justify-start" variant="secondary">
      <Link href="/admin/houses">
        <ImagesIcon data-icon="inline-start" />
        บ้านพัก
      </Link>
    </Button>
  );
}

function SignOutButton({ full = false }: { full?: boolean }) {
  return (
    <form action={signOut}>
      <Button className={full ? "w-full" : ""} type="submit" variant="outline">
        <LogOutIcon data-icon="inline-start" />
        ออกจากระบบ
      </Button>
    </form>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 border-b bg-background px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">VillaAdmin</p>
            <p className="text-xs text-muted-foreground">จัดการรูปบ้านพัก</p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="outline">
                <MenuIcon data-icon="inline-start" />
                เมนู
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>VillaAdmin</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 px-4">
                <HouseLink />
              </nav>
              <Separator className="mx-4" />
              <div className="px-4">
                <SignOutButton full />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside className="hidden w-56 shrink-0 border-r bg-background p-4 md:block">
          <p className="mb-6 text-sm font-semibold">VillaAdmin</p>
          <nav className="flex flex-col gap-1">
            <HouseLink />
          </nav>
          <div className="mt-6">
            <SignOutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
