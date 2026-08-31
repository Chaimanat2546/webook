"use client";

import { useState } from "react";
import {
  CircleCheckIcon,
  CirclePauseIcon,
  EllipsisVerticalIcon,
  KeyRoundIcon,
  PencilLineIcon,
} from "lucide-react";

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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

export type UserStatus = "active" | "password_change_required" | "suspended" | "abnormal";

export type UserTableAction =
  | "reissue_temporary_password"
  | "suspend_user"
  | "reactivate_user";

export type UserTableProps = {
  users: Array<{ email: string; status: UserStatus }>;
  onAction: (action: UserTableAction, email: string) => void;
};

const actionLabels: Record<UserTableAction, string> = {
  reissue_temporary_password: "ออกรหัสผ่านใหม่",
  suspend_user: "ระงับผู้ใช้",
  reactivate_user: "เปิดใช้ผู้ใช้",
};

function ActionIcon({ action }: { action: UserTableAction }) {
  if (action === "reissue_temporary_password") return <KeyRoundIcon aria-hidden />;
  return action === "suspend_user" ? <CirclePauseIcon aria-hidden /> : <CircleCheckIcon aria-hidden />;
}

export function getUserTableActions(status: UserStatus): UserTableAction[] {
  if (status === "active" || status === "password_change_required") {
    return ["reissue_temporary_password", "suspend_user"];
  }
  return status === "suspended" ? ["reactivate_user"] : [];
}

function StatusBadge({ status }: { status: UserStatus }) {
  const labels: Record<UserStatus, string> = {
    active: "ใช้งานอยู่",
    password_change_required: "ต้องเปลี่ยนรหัสผ่าน",
    suspended: "ระงับอยู่",
    abnormal: "ผิดปกติ",
  };
  return <Badge variant={status === "active" ? "default" : "secondary"}>{labels[status]}</Badge>;
}

function UserActionsMenu({ email, status, onAction }: { email: string; status: UserStatus; onAction: UserTableProps["onAction"] }) {
  const actions = getUserTableActions(status);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button aria-label="เปิดเมนูจัดการผู้ใช้" size="icon" type="button" variant="outline">
          <EllipsisVerticalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          {actions.map((action) => (
            <DropdownMenuItem key={action} onSelect={() => onAction(action, email)}>
              <ActionIcon action={action} />
              {actionLabels[action]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMobileActionsMenu({ email, status, onAction }: { email: string; status: UserStatus; onAction: UserTableProps["onAction"] }) {
  const [open, setOpen] = useState(false);
  const actions = getUserTableActions(status);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button className="w-full" type="button" variant="outline">
          <PencilLineIcon aria-hidden />
          จัดการ
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl p-0">
        <SheetHeader>
          <SheetTitle>จัดการผู้ใช้</SheetTitle>
        </SheetHeader>
        <div className="grid gap-2 px-4 pb-4">
          {actions.map((action) => (
            <Button
              className="justify-start"
              key={action}
              onClick={() => {
                setOpen(false);
                onAction(action, email);
              }}
              type="button"
              variant="outline"
            >
              <ActionIcon action={action} />
              {actionLabels[action]}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function UserTable({ users, onAction }: UserTableProps) {
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {users.map((user) => (
          <Card className={user.status === "suspended" ? "opacity-70" : ""} key={user.email}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">{user.email}</CardTitle>
              </div>
              <StatusBadge status={user.status} />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <UserMobileActionsMenu email={user.email} onAction={onAction} status={user.status} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden p-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60%]">อีเมล</TableHead>
              <TableHead className="w-[24%]">สถานะ</TableHead>
              <TableHead className="w-[16%] text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow className={user.status === "suspended" ? "opacity-70" : ""} key={user.email}>
                <TableCell className="font-medium"><span className="block truncate">{user.email}</span></TableCell>
                <TableCell><StatusBadge status={user.status} /></TableCell>
                <TableCell className="text-right"><UserActionsMenu email={user.email} onAction={onAction} status={user.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
