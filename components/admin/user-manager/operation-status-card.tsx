import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import type { ClientOperation } from "./types";

export function OperationStatusCard({
  operation,
  isBusy,
  onReconcile,
}: {
  operation: ClientOperation | null;
  isBusy: boolean;
  onReconcile(): void;
}) {
  if (!operation) return null;
  const requiresReview =
    operation.status === "needs_review" ||
    operation.status === "quarantined" ||
    operation.status === "in_progress" ||
    operation.status === "dispatching";

  return (
    <Card className={requiresReview ? "border-amber-300" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          รายการล่าสุด
          <Badge variant={requiresReview ? "secondary" : "outline"}>
            {operation.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p className="break-all font-mono text-muted-foreground">
          {operation.operationId}
        </p>
        {operation.agentStage ? (
          <p className="text-muted-foreground">
            ขั้นตอน Agent: <span className="font-mono">{operation.agentStage}</span>
          </p>
        ) : null}
        {operation.safeErrorCode ? (
          <p className="break-words text-muted-foreground">
            เหตุผลที่ปลอดภัย:{" "}
            <span className="font-mono">{operation.safeErrorCode}</span>
          </p>
        ) : null}
        {requiresReview ? (
          <div className="space-y-2">
            <p className="flex gap-2 text-amber-800">
              <AlertTriangleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              ต้องตรวจสอบผลรายการนี้ก่อนทำรายการเปลี่ยนแปลงใหม่
            </p>
            <Button
              className="w-full"
              disabled={isBusy}
              onClick={onReconcile}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCwIcon aria-hidden />
              ตรวจสอบสถานะ
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
