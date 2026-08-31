"use client";

import { useActionState, useEffect, useState } from "react";
import { SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { updateWebookUserFormAction } from "../../../app/admin/users/actions";
import { WEBOOK_ALLOW_TOOL_OPTIONS, type WebookManagedRole, type WebookManagedUser } from "../../../lib/webook-users";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Switch } from "../../ui/switch";
import { UserSaveNotification, UserUpdateErrorNotification } from "./user-save-notification";

interface UserEditFormProps {
  roles: WebookManagedRole[];
  section: "details" | "permissions";
  user: WebookManagedUser;
}

export function UserEditForm({ roles, section, user }: UserEditFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateWebookUserFormAction, null);
  const [dvId, setDvId] = useState(user.dvId ?? "");
  const [hasEditedDvIdSinceSubmit, setHasEditedDvIdSinceSubmit] = useState(false);
  const hasNameError = state?.ok === false && state.field === "name";
  const hasDvIdError = state?.ok === false && state.field === "dvId";
  const hasRoleIdError = state?.ok === false && state.field === "roleId";
  const hasInlineError = hasNameError || hasDvIdError || hasRoleIdError;

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [router, state]);

  if (section === "permissions") {
    return (
      <form action={formAction} className="flex min-h-full flex-col gap-4">
        <input name="id" type="hidden" value={user.id} />
        <input name="name" type="hidden" value={user.name} />
        <input name="section" type="hidden" value={section} />
        {state?.ok ? <UserSaveNotification /> : null}
        {state?.ok === false && !hasInlineError ? <UserUpdateErrorNotification message={state.message} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="webook-user-role">สิทธิ์ผู้ใช้</Label>
            <select
              aria-describedby="webook-user-role-error"
              aria-invalid={hasRoleIdError}
              className={`h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50 ${hasRoleIdError ? "border-destructive focus-visible:border-destructive focus-visible:ring-3 focus-visible:ring-destructive/20" : "border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"}`}
              defaultValue={user.roleId === null ? "" : String(user.roleId)}
              id="webook-user-role"
              name="roleId"
            >
              <option disabled value="">เลือกสิทธิ์ผู้ใช้</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <p className="min-h-5 text-sm text-destructive" id="webook-user-role-error" role={hasRoleIdError ? "alert" : undefined}>
              {hasRoleIdError ? state.message : null}
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="grid gap-3">
            <h3 className="text-sm font-medium">สิทธิ์การใช้งานระบบ</h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {WEBOOK_ALLOW_TOOL_OPTIONS.map((option) => (
              <label
                className="flex min-h-16 items-start gap-3 rounded-md border p-3 text-sm"
                htmlFor={`webook-user-${option.key}`}
                key={option.key}
              >
                <Switch
                  defaultChecked={user.allowTools?.[option.key] === true}
                  id={`webook-user-${option.key}`}
                  name={option.key}
                />
                <span className="grid gap-1">
                  <span className="font-medium leading-5">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </span>
              </label>
            ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t pt-4 lg:mt-auto">
          <Button className="w-full sm:w-fit" disabled={roles.length === 0 || isPending} type="submit">
            <SaveIcon data-icon="inline-start" />
            บันทึกสิทธิ์การใช้งาน
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="w-full max-w-none space-y-4" onSubmit={() => setHasEditedDvIdSinceSubmit(false)}>
      <input name="id" type="hidden" value={user.id} />
      <input name="roleId" type="hidden" value={user.roleId ?? ""} />
      <input name="section" type="hidden" value={section} />
      {state?.ok ? <UserSaveNotification /> : null}
      {state?.ok === false && !hasInlineError ? <UserUpdateErrorNotification message={state.message} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="webook-user-name">ชื่อ</Label>
          <Input
            aria-describedby="webook-user-name-error"
            aria-invalid={hasNameError}
            autoComplete="name"
            className={hasNameError ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20" : undefined}
            defaultValue={user.name}
            id="webook-user-name"
            maxLength={150}
            name="name"
          />
          <p className="min-h-5 text-sm text-destructive" id="webook-user-name-error" role={hasNameError ? "alert" : undefined}>
            {hasNameError ? state.message : null}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="webook-user-dv-id">DV ID</Label>
          <Input
            aria-describedby="webook-user-dv-id-error"
            aria-invalid={hasDvIdError}
            className={hasDvIdError ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20" : undefined}
            id="webook-user-dv-id"
            inputMode="numeric"
            maxLength={19}
            name="dvId"
            onInput={(event) => {
              setHasEditedDvIdSinceSubmit(true);
              setDvId(event.currentTarget.value.replace(/\D/g, ""));
            }}
            value={state?.ok && !hasEditedDvIdSinceSubmit ? state.user.dvId ?? "" : dvId}
          />
          <p
            className={`min-h-5 text-sm ${hasDvIdError ? "text-destructive" : "text-muted-foreground"}`}
            id="webook-user-dv-id-error"
            role={hasDvIdError ? "alert" : undefined}
          >
            {hasDvIdError ? state.message : "DV ID ต้องเป็นตัวเลข และห้ามซ้ำกับผู้ใช้อื่น"}
          </p>
        </div>
      </div>

      {user.roleId === null ? (
        <p className="text-sm text-muted-foreground">กรุณากำหนดสิทธิ์ผู้ใช้ก่อนแก้ไขข้อมูลผู้ใช้</p>
      ) : null}

      <FormActions disabled={user.roleId === null || isPending} />
    </form>
  );
}

function FormActions({ disabled }: { disabled: boolean }) {
  return (
    <div className="flex justify-end">
      <Button disabled={disabled} type="submit">
        <SaveIcon data-icon="inline-start" />
        บันทึกข้อมูลผู้ใช้
      </Button>
    </div>
  );
}
