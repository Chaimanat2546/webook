import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, PencilIcon } from "lucide-react";
import Link from "next/link";

import type {
  WebookManagedRole,
  WebookManagedUser,
} from "../../../lib/webook-users";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

function displayText(value: string): string {
  return value && value.toLowerCase() !== "null" ? value : "-";
}

function roleName(roles: WebookManagedRole[], roleId: number | null): string {
  return roles.find((role) => role.id === roleId)?.name ?? "-";
}

type UserSortBy = "dvId" | "email" | "name" | "role" | "username";

function SortButton({
  children,
  roleIds,
  search,
  sortBy,
  sortDirection,
  value,
}: {
  children: string;
  roleIds: number[];
  search: string;
  sortBy: UserSortBy;
  sortDirection: "asc" | "desc";
  value: UserSortBy;
}) {
  const nextDirection = sortBy === value && sortDirection === "asc" ? "desc" : "asc";
  const params = new URLSearchParams({ sort: value, dir: nextDirection });
  if (search) params.set("q", search);
  if (roleIds.length > 0) params.set("roles", roleIds.join(","));
  const Icon = sortBy !== value ? ArrowUpDownIcon : sortDirection === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <Button asChild className="-ml-2 h-8 font-medium" size="sm" variant="ghost">
      <Link href={`/admin/users?${params.toString()}`}>
        {children}
        <Icon aria-hidden />
      </Link>
    </Button>
  );
}

function EditButton({ userId }: { userId: string }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={`/admin/users/${encodeURIComponent(userId)}`}>
        <PencilIcon aria-hidden data-icon="inline-start" />
        แก้ไข
      </Link>
    </Button>
  );
}

export function UserTable({
  roles,
  roleIds,
  search,
  sortBy,
  sortDirection,
  users,
}: {
  roles: WebookManagedRole[];
  roleIds: number[];
  search: string;
  sortBy: UserSortBy;
  sortDirection: "asc" | "desc";
  users: WebookManagedUser[];
}) {
  return (
    <>
      {users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            ยังไม่มีผู้ใช้ในระบบ
          </CardContent>
        </Card>
      ) : null}
      {users.length > 0 ? (
        <>
      <div className="grid gap-3 md:hidden">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">{displayText(user.name)}</CardTitle>
                <p className="truncate text-xs text-muted-foreground">{displayText(user.email)}</p>
              </div>
              <Badge variant="secondary">{roleName(roles, user.roleId)}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">DV ID</dt>
                  <dd>{user.dvId ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Username</dt>
                  <dd>{displayText(user.username)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">อีเมล</dt>
                  <dd className="break-all">{displayText(user.email)}</dd>
                </div>
              </dl>
              <EditButton userId={user.id} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%]"><SortButton roleIds={roleIds} search={search} sortBy={sortBy} sortDirection={sortDirection} value="name">ชื่อ</SortButton></TableHead>
              <TableHead className="w-[15%]"><SortButton roleIds={roleIds} search={search} sortBy={sortBy} sortDirection={sortDirection} value="username">Username</SortButton></TableHead>
              <TableHead className="w-[22%]"><SortButton roleIds={roleIds} search={search} sortBy={sortBy} sortDirection={sortDirection} value="email">อีเมล</SortButton></TableHead>
              <TableHead className="w-[13%]"><SortButton roleIds={roleIds} search={search} sortBy={sortBy} sortDirection={sortDirection} value="dvId">DV ID</SortButton></TableHead>
              <TableHead className="w-[18%]"><SortButton roleIds={roleIds} search={search} sortBy={sortBy} sortDirection={sortDirection} value="role">สิทธิ์ผู้ใช้</SortButton></TableHead>
              <TableHead className="w-[12%] text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="truncate font-medium">{displayText(user.name)}</TableCell>
                <TableCell className="truncate text-muted-foreground">{displayText(user.username)}</TableCell>
                <TableCell className="truncate text-muted-foreground">{displayText(user.email)}</TableCell>
                <TableCell className="truncate text-muted-foreground">{user.dvId ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleName(roles, user.roleId)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <EditButton userId={user.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
        </>
      ) : null}
    </>
  );
}
