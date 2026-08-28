import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { WebookManagedRole } from "../../../lib/webook-users";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { UserRoleFilter } from "./user-role-filter";

export function UserManagementPage({
  roles,
  roleIds,
  search,
  sortBy,
  sortDirection,
  children,
}: {
  roles: WebookManagedRole[];
  roleIds: number[];
  search: string;
  sortBy: string;
  sortDirection: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">จัดการผู้ใช้ Webook</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          แก้ไขชื่อและสิทธิ์ผู้ใช้ในระบบ Webook
        </p>
      </header>

      <form className="flex flex-wrap gap-2 md:max-w-xl">
        {roleIds.length > 0 ? <input name="roles" type="hidden" value={roleIds.join(",")} /> : null}
        {sortBy !== "name" ? <input name="sort" type="hidden" value={sortBy} /> : null}
        {sortDirection !== "asc" ? <input name="dir" type="hidden" value={sortDirection} /> : null}
        <Input
          className="min-w-0 flex-1"
          defaultValue={search}
          name="q"
          placeholder="ค้นหาชื่อ, Username หรืออีเมล..."
          type="search"
        />
        <UserRoleFilter roles={roles} selectedRoleIds={roleIds} />
        <Button className="shrink-0" type="submit">
          <SearchIcon aria-hidden className="size-4" />
          ค้นหา
        </Button>
      </form>

      {children}
    </div>
  );
}
