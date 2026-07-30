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
import { formatUserManagerDate } from "./view-model";
import { UserStatusBadge } from "./user-status-badge";

export function UserTable({
  users,
  page,
  hasMore,
  isBusy,
  selectedUserId,
  onSelectUser,
  onPageChange,
}: {
  users: ManagedUser[];
  page: number;
  hasMore: boolean;
  isBusy: boolean;
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
        {users.length === 0 ? (
          <Empty className="min-h-56 border">
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
            <div className="space-y-2 md:hidden">
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
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
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
                      data-state={user.userId === selectedUserId ? "selected" : undefined}
                      key={user.userId}
                    >
                      <TableCell className="max-w-56 truncate font-medium" title={user.email}>
                        {user.email}
                      </TableCell>
                      <TableCell><UserStatusBadge status={user.status} /></TableCell>
                      <TableCell>{formatUserManagerDate(user.createdAt)}</TableCell>
                      <TableCell>{formatUserManagerDate(user.lastSignInAt)}</TableCell>
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
