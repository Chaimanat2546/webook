"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { createCentralUserAction, listCentralUsersAction, reactivateCentralUserAction, reissueCentralUserPasswordAction, suspendCentralUserAction } from "../../../app/admin/user-manager/actions";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { createCentralUserListFormData } from "./user-list-request";
import { UserTable, type UserTableAction } from "./user-table";

type SafeResult = Awaited<ReturnType<typeof listCentralUsersAction>>;
type Action = (formData: FormData) => Promise<SafeResult>;
type Tenant = { key: string; displayName: string; environment: string; enabled: boolean };
type ListedOperation = Extract<SafeResult, { ok: true }>['operation'];
type DialogAction = { action: Action; label: string; email?: string };

const rowActions: Record<UserTableAction, { action: Action; label: string }> = {
  reissue_temporary_password: { action: reissueCentralUserPasswordAction, label: "ออกรหัสผ่านใหม่" },
  suspend_user: { action: suspendCentralUserAction, label: "ระงับผู้ใช้" },
  reactivate_user: { action: reactivateCentralUserAction, label: "เปิดใช้ผู้ใช้" },
};

function statusMessage(status: Extract<SafeResult, { ok: true }>['operation']['status']) {
  return status === "completed" ? "ดำเนินการเรียบร้อย" : status === "in_progress" ? "คำขอกำลังดำเนินการอยู่" : status === "needs_review" ? "คำขอต้องได้รับการตรวจสอบ" : "คำขอถูกกักไว้เพื่อความปลอดภัย";
}

export function UserManagerPage({ tenants }: { tenants: Tenant[] }) {
  const [selectedKey, setSelectedKey] = useState(tenants[0]?.key ?? "");
  const [listed, setListed] = useState<ListedOperation | null>(null);
  const [listError, setListError] = useState("");
  const [dialogAction, setDialogAction] = useState<DialogAction | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState<{ email: string; value: string } | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [mutationMessage, setMutationMessage] = useState("");
  const [listPending, startListTransition] = useTransition();
  const [pending, startTransition] = useTransition();
  const latestListRequest = useRef(0);
  const selected = tenants.find((tenant) => tenant.key === selectedKey);

  const loadUsers = useCallback((tenantKey: string, page: number) => {
    const requestId = ++latestListRequest.current;
    startListTransition(async () => {
      const result = await listCentralUsersAction(createCentralUserListFormData({ tenantKey, page, operationId: crypto.randomUUID() }));
      if (requestId !== latestListRequest.current) return;
      if (!result.ok) return setListError(result.error.message);
      setListError("");
      setListed(result.operation);
    });
  }, []);

  useEffect(() => {
    if (selectedKey) loadUsers(selectedKey, 1);
  }, [loadUsers, selectedKey]);

  const closeAction = () => { setDialogAction(null); setEmail(""); };
  const selectedEmail = dialogAction?.email ?? email;
  const currentPage = listed?.pagination?.page ?? 1;

  async function copyTemporaryPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password.value);
    setCopyMessage("คัดลอกแล้ว");
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-semibold">จัดการผู้ใช้ระบบบ้านพัก</h1><p className="text-sm text-muted-foreground">จัดการผู้ดูแลระบบแยกตาม Tenant ที่ได้รับอนุญาต</p>{mutationMessage ? <p className="text-sm text-muted-foreground" role="status">{mutationMessage}</p> : null}</div>
      <Button disabled={!selected?.enabled} onClick={() => { setEmail(""); setDialogAction({ action: createCentralUserAction, label: "สร้างผู้ใช้" }); }} type="button">สร้างผู้ใช้</Button>
    </div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
      <aside className="rounded-md border p-3"><h2 className="mb-2 font-medium">เลือก Tenant</h2><div className="space-y-2">{tenants.map((tenant) => <button className={`w-full rounded p-2 text-left text-sm ${tenant.key === selectedKey ? "bg-muted" : "hover:bg-muted"}`} key={tenant.key} onClick={() => { if (tenant.key !== selectedKey) { setSelectedKey(tenant.key); setListed(null); setListError(""); setPassword(null); setMutationMessage(""); } }} type="button"><span className="block font-medium">{tenant.displayName}</span><span className="text-muted-foreground">{tenant.environment}{tenant.enabled ? "" : " · ปิดใช้งาน"}</span></button>)}</div></aside>
      <section className="min-w-0 rounded-md border p-3"><h2 className="mb-3 font-medium">ผู้ใช้ของ Tenant</h2>{listPending && !listed ? <p className="text-sm text-muted-foreground" role="status">กำลังโหลดรายชื่อผู้ใช้...</p> : null}{listError ? <p className="text-sm text-destructive" role="alert">{listError}</p> : null}{listed?.users && listed.pagination ? <><div aria-busy={listPending}>{listed.users.length ? <UserTable onAction={(actionName, rowEmail) => { const { action, label } = rowActions[actionName]; setEmail(rowEmail); setDialogAction({ action, label, email: rowEmail }); }} users={listed.users} /> : <p className="py-2 text-sm text-muted-foreground">ไม่พบผู้ใช้</p>}</div><div className="mt-3 flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">หน้า {listed.pagination.page} · {listed.pagination.hasMore ? "มีหน้าถัดไป" : "หน้าสุดท้าย"}</p><div className="flex gap-2"><Button disabled={listPending || listed.pagination.page === 1} onClick={() => loadUsers(selectedKey, listed.pagination!.page - 1)} size="sm" type="button" variant="outline">ก่อนหน้า</Button><Button disabled={listPending || !listed.pagination.hasMore} onClick={() => loadUsers(selectedKey, listed.pagination!.page + 1)} size="sm" type="button" variant="outline">ถัดไป</Button></div></div></> : null}</section>
      <aside><div className="rounded-md border p-3"><h2 className="font-medium">{selected?.displayName ?? "ยังไม่ได้เลือก Tenant"}</h2><p className="text-sm text-muted-foreground">{selected?.environment}</p></div></aside>
    </div>
    <Dialog onOpenChange={(open) => { if (!open) closeAction(); }} open={dialogAction !== null}><DialogContent onOpenAutoFocus={(event) => event.preventDefault()}><DialogHeader><DialogTitle>{dialogAction?.label}</DialogTitle><DialogDescription>ยืนยันการจัดการผู้ใช้ใน Tenant ที่เลือก</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); if (!dialogAction || !selected) return; const data = new FormData(); data.set("email", selectedEmail); data.set("tenantKey", selected.key); data.set("operationId", crypto.randomUUID()); startTransition(async () => { const result = await dialogAction.action(data); setMutationMessage(result.ok ? statusMessage(result.operation.status) : result.error.message); if (result.ok && result.operation.temporaryPassword) setPassword({ email: selectedEmail, value: result.operation.temporaryPassword }); if (result.ok) loadUsers(selected.key, currentPage); closeAction(); }); }}><Label htmlFor="central-user-email">อีเมล</Label><Input disabled={Boolean(dialogAction?.email)} id="central-user-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={selectedEmail} /><DialogFooter><Button disabled={pending} type="submit">ยืนยัน</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog onOpenChange={(open) => { if (!open) { setPassword(null); setCopyMessage(""); } }} open={password !== null}><DialogContent onOpenAutoFocus={(event) => event.preventDefault()}><DialogHeader><DialogTitle>รหัสผ่านชั่วคราว</DialogTitle><DialogDescription>สำหรับ {password?.email} แสดงเพียงครั้งเดียว</DialogDescription></DialogHeader><div className="flex gap-2"><Input aria-label="รหัสผ่านชั่วคราว" disabled value={password?.value ?? ""} /><Button onClick={() => void copyTemporaryPassword()} type="button" variant="outline">คัดลอก</Button></div>{copyMessage ? <p role="status" className="text-sm text-muted-foreground">{copyMessage}</p> : null}<DialogFooter><Button onClick={() => { setPassword(null); setCopyMessage(""); }} type="button">ฉันบันทึกรหัสแล้ว</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
