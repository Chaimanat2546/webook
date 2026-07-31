"use client";

import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Button } from "../../ui/button";
import { CreateUserDialog } from "./create-user-dialog";
import { ProjectList } from "./project-list";
import { StatusPanel } from "./status-panel";
import { TemporaryPasswordDialog } from "./temporary-password-dialog";
import type {
  ManagedUser,
  UserLifecycleAction,
  UserManagerProject,
} from "./types";
import { useUserManager } from "./use-user-manager";
import { UserActionDialog } from "./user-action-dialog";
import { UserTable } from "./user-table";

export function UserManagerPage({
  initialProjects,
}: {
  initialProjects: UserManagerProject[];
}) {
  const manager = useUserManager(initialProjects);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: Exclude<UserLifecycleAction, "create_user">;
    user: ManagedUser;
  } | null>(null);
  const selectedUser = useMemo(
    () => manager.users.find((user) => user.userId === selectedUserId) ?? null,
    [manager.users, selectedUserId],
  );
  const operationRequiresReview =
    manager.operation?.status === "needs_review" ||
    manager.operation?.status === "quarantined" ||
    manager.operation?.status === "in_progress" ||
    manager.operation?.status === "dispatching";
  const canMutate =
    manager.selectedProject?.isActive === true &&
    manager.health?.status === "healthy" &&
    manager.health.tenantId === manager.selectedProject.id &&
    !operationRequiresReview &&
    !manager.hasPendingReview;

  function selectProject(projectId: string) {
    setSelectedUserId(null);
    manager.clearTemporaryPassword();
    manager.selectProject(projectId);
  }

  async function createUser(email: string) {
    await manager.runUserAction("create_user", email);
    setCreateOpen(false);
  }

  async function confirmAction() {
    if (!pendingAction) return;
    await manager.runUserAction(
      pendingAction.action,
      pendingAction.user.email,
    );
    setPendingAction(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">จัดการผู้ใช้ระบบบ้านพัก</h1>
          <p className="text-sm font-medium text-muted-foreground">
            จัดการผู้ดูแลระบบแยกตามระบบบ้านพัก
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          disabled={!canMutate || manager.isBusy}
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          <PlusIcon aria-hidden />
          สร้างผู้ใช้
        </Button>
      </div>
      {manager.error ? (
        <Alert variant="destructive">
          <AlertTitle>ไม่สามารถดำเนินการได้</AlertTitle>
          <AlertDescription>{manager.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid min-w-0 gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <ProjectList
          isBusy={manager.isBusy}
          onSelect={selectProject}
          projects={manager.projects}
          selectedProjectId={manager.selectedProjectId}
        />
        <UserTable
          hasMore={manager.hasMore}
          isBusy={manager.isBusy}
          isLoadingUsers={manager.isLoadingUsers}
          onPageChange={(page) => void manager.loadUsers(page)}
          onSelectUser={(user) => setSelectedUserId(user.userId)}
          page={manager.page}
          selectedUserId={selectedUserId}
          users={manager.users}
        />
        <StatusPanel
          canMutate={canMutate}
          health={manager.health}
          isBusy={manager.isBusy}
          onAction={(action, user) => {
            if (action !== "create_user") setPendingAction({ action, user });
          }}
          onReconcile={() => void manager.reconcile()}
          onReactivateProject={() => void manager.reactivateProject()}
          onRefreshHealth={() => void manager.checkHealth()}
          operation={manager.operation}
          project={manager.selectedProject}
          selectedUser={selectedUser}
        />
      </div>
      <CreateUserDialog
        isBusy={manager.isBusy}
        onOpenChange={setCreateOpen}
        onSubmit={(email) => void createUser(email)}
        open={createOpen}
      />
      <UserActionDialog
        action={pendingAction?.action ?? null}
        isBusy={manager.isBusy}
        onConfirm={() => void confirmAction()}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        user={pendingAction?.user ?? null}
      />
      <TemporaryPasswordDialog
        email={manager.temporaryCredential?.email ?? null}
        projectName={
          manager.projects.find(
            (project) => project.id === manager.temporaryCredential?.tenantId,
          )?.displayName ?? null
        }
        onAcknowledge={manager.clearTemporaryPassword}
        password={manager.temporaryCredential?.password ?? null}
      />
    </div>
  );
}
