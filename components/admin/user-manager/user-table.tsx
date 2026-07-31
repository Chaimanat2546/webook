import { ChevronLeftIcon, ChevronRightIcon, UserRoundIcon } from "lucide-react";

import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import type { ManagedUser } from "./types";
import {
  USER_TABLE_VIEWPORT_CLASS,
  UserTableSkeleton,
} from "./user-table-skeleton";
import { formatUserManagerDate } from "./view-model";
import { UserStatusBadge } from "./user-status-badge";

export function UserTable({
  users,
  page,
  hasMore,
  isBusy,
  isLoadingUsers,
  selectedUserId,
  onSelectUser,
  onPageChange,
}: {
  users: ManagedUser[];
  page: number;
  hasMore: boolean;
  isBusy: boolean;
  isLoadingUsers: boolean;
  selectedUserId: string | null;
  onSelectUser(user: ManagedUser): void;
  onPageChange(page: number): void;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-sm">ผู้ดูแลระบบ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          aria-busy={isLoadingUsers}
          className={`${USER_TABLE_VIEWPORT_CLASS} overflow-x-auto overflow-y-auto overscroll-contain`}
        >
          {isLoadingUsers ? (
            <UserTableSkeleton />
          ) : users.length === 0 ? (
            <Empty className="h-full border">
              <EmptyHeader>
                <UserRoundIcon aria-hidden className="mx-auto size-8 text-muted-foreground" />
                <EmptyTitle>ยังไม่พบผู้ดูแลระบบ</EmptyTitle>
                <EmptyDescription>
                  เลือกโครงการที่พร้อมใช้งานหรือสร้างผู้ใช้ใหม่
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <div className="space-y-2 p-1 md:hidden">
                {users.map((user) => (
                  <button
                    aria-pressed={user.userId === selectedUserId}
                    className="w-full min-w-0 rounded-lg border p-3 text-left aria-pressed:border-primary"
                    key={user.userId}
                    onClick={() => onSelectUser(user)}
                    type="button"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate font-medium" title={user.email}>
                        {user.email}
                      </span>
                      <UserStatusBadge status={user.status} />
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      เข้าสู่ระบบล่าสุด {formatUserManagerDate(user.lastSignInAt)}
                    </span>
                  </button>
                ))}
              </div>
              <div className="hidden min-w-[40rem] md:block">
                <Table className="table-fixed">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[14%]" />
                    <col className="w-[18%]" />
                    <col className="w-[22%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>อีเมล</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>สร้างเมื่อ</TableHead>
                      <TableHead>เข้าสู่ระบบล่าสุด</TableHead>
                      <TableHead className="text-right">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow
                        className="h-12"
                        data-state={user.userId === selectedUserId ? "selected" : undefined}
                        key={user.userId}
                      >
                        <TableCell className="max-w-56 truncate font-medium" title={user.email}>
                          {user.email}
                        </TableCell>
                        <TableCell className="truncate">
                          <UserStatusBadge status={user.status} />
                        </TableCell>
                        <TableCell
                          className="truncate"
                          title={formatUserManagerDate(user.createdAt)}
                        >
                          {formatUserManagerDate(user.createdAt)}
                        </TableCell>
                        <TableCell
                          className="truncate"
                          title={formatUserManagerDate(user.lastSignInAt)}
                        >
                          {formatUserManagerDate(user.lastSignInAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            onClick={() => onSelectUser(user)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            เลือก
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Button
            disabled={isBusy || page <= 1}
            onClick={() => onPageChange(page - 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon aria-hidden />
            ก่อนหน้า
          </Button>
          <span className="text-xs text-muted-foreground">หน้า {page}</span>
          <Button
            disabled={isBusy || !hasMore || page >= 100}
            onClick={() => onPageChange(page + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            ถัดไป
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
