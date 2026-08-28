import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

export function UserManagementPage({
  search,
  children,
}: {
  search: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">จัดการผู้ใช้ Webook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          แก้ไขชื่อและ Role ของผู้ใช้ในระบบ Webook
        </p>
      </header>

      <form className="flex gap-2 md:max-w-sm">
        <Input
          className="min-w-0 flex-1"
          defaultValue={search}
          name="q"
          placeholder="ค้นหาชื่อ, Username หรืออีเมล..."
          type="search"
        />
        <Button className="shrink-0" type="submit">
          <SearchIcon aria-hidden className="size-4" />
          ค้นหา
        </Button>
      </form>

      {children}
    </div>
  );
}
