"use client";

import {
  BanIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  ShieldCheckIcon,
} from "lucide-react";

import type { WebookManagedUser } from "../../../server/repositories/webook-users";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

export type WebookUserAction = "edit" | "ban" | "unban";

interface UserTableProps {
  users: WebookManagedUser[];
  onAction: (action: WebookUserAction, user: WebookManagedUser) => void;
}

export function getWebookUserActions(isBanned: boolean): WebookUserAction[] {
  return isBanned ? ["edit", "unban"] : ["edit", "ban"];
}

function displayValue(value: string): string {
  return value || "—";
}

function UserStatusBadge({ isBanned }: { isBanned: boolean }) {
  return (
    <Badge variant={isBanned ? "destructive" : "default"}>
      {isBanned ? "ถูก Ban" : "ใช้งานอยู่"}
    </Badge>
  );
}

function UserActionsMenu({
  onAction,
  user,
}: {
  onAction: UserTableProps["onAction"];
  user: WebookManagedUser;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`เปิดเมนูจัดการผู้ใช้ ${user.name || user.email}`}
          size="icon"
          type="button"
          variant="outline"
        >
          <EllipsisVerticalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          {getWebookUserActions(user.isBanned).map((action) => {
            if (action === "edit") {
              return (
                <DropdownMenuItem key={action} onSelect={() => onAction(action, user)}>
                  <PencilIcon aria-hidden />
                  แก้ไข
                </DropdownMenuItem>
              );
            }

            if (action === "ban") {
              return (
                <DropdownMenuItem
                  key={action}
                  onSelect={() => onAction(action, user)}
                  variant="destructive"
                >
                  <BanIcon aria-hidden />
                  Ban
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem key={action} onSelect={() => onAction(action, user)}>
                <ShieldCheckIcon aria-hidden />
                ปลด Ban
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserTable({ onAction, users }: UserTableProps) {
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {users.map((user) => (
          <Card className={user.isBanned ? "opacity-70" : ""} key={user.id}>
            <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate">{displayValue(user.name)}</CardTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {displayValue(user.username)}
                </p>
              </div>
              <UserStatusBadge isBanned={user.isBanned} />
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">อีเมล</dt>
                <dd className="break-all">{displayValue(user.email)}</dd>
                <dt className="text-muted-foreground">เบอร์โทร</dt>
                <dd>{displayValue(user.tel)}</dd>
              </dl>
              <div className="flex justify-end">
                <UserActionsMenu onAction={onAction} user={user} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>อีเมล</TableHead>
              <TableHead>เบอร์โทร</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow className={user.isBanned ? "opacity-70" : ""} key={user.id}>
                <TableCell className="max-w-48 font-medium">
                  <span className="block truncate">{displayValue(user.name)}</span>
                </TableCell>
                <TableCell className="max-w-40">
                  <span className="block truncate">{displayValue(user.username)}</span>
                </TableCell>
                <TableCell className="max-w-64">
                  <span className="block truncate">{displayValue(user.email)}</span>
                </TableCell>
                <TableCell>{displayValue(user.tel)}</TableCell>
                <TableCell>
                  <UserStatusBadge isBanned={user.isBanned} />
                </TableCell>
                <TableCell className="text-right">
                  <UserActionsMenu onAction={onAction} user={user} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
