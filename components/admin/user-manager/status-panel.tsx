import {
  ActivityIcon,
  KeyRoundIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Separator } from "../../ui/separator";
import type {
  ClientOperation,
  ManagedUser,
  UserLifecycleAction,
  UserManagerHealth,
  UserManagerProject,
} from "./types";
import { OperationStatusCard } from "./operation-status-card";
import { UserStatusBadge } from "./user-status-badge";
import { getProjectLifecycle } from "./view-model";

export function StatusPanel({
  project,
  health,
  selectedUser,
  operation,
  isBusy,
  canMutate,
  onRefreshHealth,
  onReactivateProject,
  onAction,
  onReconcile,
}: {
  project: UserManagerProject | null;
  health: UserManagerHealth | null;
  selectedUser: ManagedUser | null;
  operation: ClientOperation | null;
  isBusy: boolean;
  canMutate: boolean;
  onRefreshHealth(): void;
  onReactivateProject(): void;
  onAction(action: UserLifecycleAction, user: ManagedUser): void;
  onReconcile(): void;
}) {
  const requiresReactivation =
    project !== null &&
    getProjectLifecycle(project) === "reactivation_required";

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">สถานะและการดำเนินการ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">สถานะ</span>
            <Badge variant={health?.status === "healthy" ? "default" : "secondary"}>
              {health?.status === "healthy" ? "พร้อมใช้งาน" : "ยังไม่ยืนยัน"}
            </Badge>
          </div>
          {requiresReactivation ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
              <p className="text-sm font-medium">ระบบนี้นี้ถูกปิดหลังตรวจสอบสถานะไม่ผ่าน</p>
              <p className="text-xs">
                ระบบจะตรวจสถานะและอ่านรายชื่อแบบจำกัดเดิมก่อนเปิดใช้งาน
              </p>
              <Button
                className="w-full"
                disabled={isBusy}
                onClick={onReactivateProject}
                size="sm"
                type="button"
              >
                <ShieldCheckIcon aria-hidden />
                ตรวจสอบและเปิดใช้งานอีกครั้ง
              </Button>
            </div>
          ) : null}
          <Button
            className="w-full"
            disabled={!project?.isActive || isBusy}
            onClick={onRefreshHealth}
            size="sm"
            type="button"
            variant="outline"
          >
            <ActivityIcon aria-hidden />
            ตรวจสถานะล่าสุด
          </Button>
          <Separator />
          {selectedUser ? (
            <div className="space-y-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">ผู้ใช้ที่เลือก</p>
                <p
                  className="mt-1 [overflow-wrap:anywhere] text-sm font-medium"
                  title={selectedUser.email}
                >
                  {selectedUser.email}
                </p>
                <div className="mt-2"><UserStatusBadge status={selectedUser.status} /></div>
              </div>
              {selectedUser.status !== "abnormal" ? (
                <div className="grid gap-2">
                  {selectedUser.status === "suspended" ? (
                    <Button
                      disabled={!canMutate || isBusy}
                      onClick={() => onAction("reactivate_user", selectedUser)}
                      size="sm"
                      type="button"
                    >
                      <PlayCircleIcon aria-hidden />
                      เปิดใช้งานและออกรหัสใหม่
                    </Button>
                  ) : (
                    <>
                      <Button
                        disabled={!canMutate || isBusy}
                        onClick={() => onAction("reissue_temporary_password", selectedUser)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <KeyRoundIcon aria-hidden />
                        ออกรหัสชั่วคราวใหม่
                      </Button>
                      <Button
                        disabled={!canMutate || isBusy}
                        onClick={() => onAction("suspend_user", selectedUser)}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        <PauseCircleIcon aria-hidden />
                        ระงับผู้ใช้
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-destructive">
                  ข้อมูลผู้ใช้ผิดปกติ กรุณาตรวจสอบก่อนดำเนินการ
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              เลือกผู้ใช้เพื่อดูรายละเอียดและคำสั่งที่อนุญาต
            </p>
          )}
        </CardContent>
      </Card>
      <OperationStatusCard
        isBusy={isBusy}
        onReconcile={onReconcile}
        operation={operation}
      />
    </div>
  );
}
