import { PencilIcon } from "lucide-react";

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
  return value || "-";
}

function roleName(roles: WebookManagedRole[], roleId: number | null): string {
  return roles.find((role) => role.id === roleId)?.name ?? "ไม่ระบุ Role";
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} size="sm" type="button" variant="outline">
      <PencilIcon aria-hidden data-icon="inline-start" />
      แก้ไข
    </Button>
  );
}

export function UserTable({
  onEdit,
  roles,
  users,
}: {
  onEdit: (user: WebookManagedUser) => void;
  roles: WebookManagedRole[];
  users: WebookManagedUser[];
}) {
  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          ยังไม่มีผู้ใช้ในระบบ
        </CardContent>
      </Card>
    );
  }

  return (
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
                  <dt className="text-xs text-muted-foreground">Username</dt>
                  <dd>{displayText(user.username)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">อีเมล</dt>
                  <dd className="break-all">{displayText(user.email)}</dd>
                </div>
              </dl>
              <EditButton onClick={() => onEdit(user)} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">ชื่อ</TableHead>
              <TableHead className="w-[20%]">Username</TableHead>
              <TableHead className="w-[28%]">อีเมล</TableHead>
              <TableHead className="w-[14%]">Role</TableHead>
              <TableHead className="w-[10%] text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="truncate font-medium">{displayText(user.name)}</TableCell>
                <TableCell className="truncate text-muted-foreground">{displayText(user.username)}</TableCell>
                <TableCell className="truncate text-muted-foreground">{displayText(user.email)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{roleName(roles, user.roleId)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <EditButton onClick={() => onEdit(user)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
