"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import {
  lookupQuotationCustomerDbdAction,
  refreshQuotationCustomerDbdAction,
  saveQuotationCustomerAction,
  setQuotationCustomerActiveAction,
} from "../../../../app/admin/quotations/customers/actions";
import {
  resetQuotationCustomerFromDbd,
  type DbdCustomerDefaults,
  type QuotationCustomerInput,
  type QuotationCustomerMaster,
} from "../../../../lib/quotation-customer-types";
import { Button } from "../../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../ui/dialog";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../../ui/radio-group";
import { Textarea } from "../../../ui/textarea";

export interface QuotationCustomerFormProps {
  customer: QuotationCustomerMaster | null;
  onCancel: () => void;
  onSaved: (customer: QuotationCustomerMaster) => void;
}

function initialInput(customer: QuotationCustomerMaster | null): QuotationCustomerInput {
  return customer ? {
    address: customer.address,
    branchNumber: customer.branchNumber,
    contactEmail: customer.contactEmail,
    contactName: customer.contactName,
    contactPhone: customer.contactPhone,
    customerType: customer.customerType,
    id: customer.id,
    name: customer.name,
    officeType: customer.officeType,
    saveUnverified: false,
    taxId: customer.taxId,
  } : {
    address: "",
    branchNumber: "",
    contactEmail: "",
    contactName: "",
    contactPhone: "",
    customerType: "juristic",
    id: null,
    name: "",
    officeType: "head_office",
    saveUnverified: false,
    taxId: "",
  };
}

function storedDefaults(customer: QuotationCustomerMaster | null): DbdCustomerDefaults | null {
  return customer?.dbdAddress && customer.dbdName && customer.dbdStatus && customer.dbdVerifiedAt
    ? {
        address: customer.dbdAddress,
        name: customer.dbdName,
        status: customer.dbdStatus,
        taxId: customer.taxId,
        verifiedAt: customer.dbdVerifiedAt,
      }
    : null;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p className="text-xs text-destructive" id={id} role="alert">{message}</p> : null;
}

export function QuotationCustomerForm({
  customer,
  onCancel,
  onSaved,
}: QuotationCustomerFormProps) {
  const [value, setValue] = useState(() => initialInput(customer));
  const [dbdDefaults, setDbdDefaults] = useState(() => storedDefaults(customer));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [existingCustomer, setExistingCustomer] = useState<QuotationCustomerMaster | null>(null);
  const [confirmReactivation, setConfirmReactivation] = useState(false);
  const [confirmUnverified, setConfirmUnverified] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<"dbd" | "reactivate" | "save" | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof QuotationCustomerInput>(key: K, next: QuotationCustomerInput[K]) {
    setValue((current) => ({ ...current, [key]: next }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setExistingCustomer(null);
    setConfirmReactivation(false);
  }

  function save(saveUnverified: boolean) {
    setFieldErrors({});
    setFormError("");
    setExistingCustomer(null);
    setPendingOperation("save");
    startTransition(async () => {
      try {
        const result = await saveQuotationCustomerAction({ ...value, saveUnverified });
        if (!result.ok) {
          setFieldErrors(result.fieldErrors);
          setFormError(result.formError);
          setExistingCustomer(result.existingCustomer ?? null);
          if (result.requiresUnverifiedConfirmation) setConfirmUnverified(true);
          return;
        }
        toast.success(customer ? "บันทึกข้อมูลลูกค้าแล้ว" : "เพิ่มลูกค้าแล้ว");
        onSaved(result.customer);
      } finally {
        setPendingOperation(null);
      }
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(false);
  }

  function checkDbd() {
    setFormError("");
    setPendingOperation("dbd");
    startTransition(async () => {
      try {
        if (customer) {
          const refreshed = await refreshQuotationCustomerDbdAction(customer.id);
          if (!refreshed.ok) {
            setFormError(refreshed.formError);
            return;
          }
          const defaults = storedDefaults(refreshed.customer);
          setDbdDefaults(defaults);
          toast.success("รีเฟรชข้อมูล DBD แล้ว");
          return;
        }
        const result = await lookupQuotationCustomerDbdAction(value.taxId);
        if (!result.ok) {
          setFormError(result.formError);
          return;
        }
        setDbdDefaults(result.defaults);
        setValue((current) => resetQuotationCustomerFromDbd(current, result.defaults));
        toast.success("ตรวจสอบข้อมูล DBD แล้ว");
      } finally {
        setPendingOperation(null);
      }
    });
  }

  function reactivateExisting() {
    if (!existingCustomer) return;
    setFormError("");
    setPendingOperation("reactivate");
    startTransition(async () => {
      try {
        const result = await setQuotationCustomerActiveAction(existingCustomer.id, true);
        if (!result.ok) {
          setFormError(result.formError);
          return;
        }
        toast.success("เปิดใช้งานลูกค้าเดิมแล้ว");
        onSaved(result.customer);
      } finally {
        setPendingOperation(null);
      }
    });
  }

  function resetFromDbd() {
    if (!dbdDefaults || value.taxId !== dbdDefaults.taxId) return;
    setValue((current) => resetQuotationCustomerFromDbd(current, dbdDefaults));
  }

  const inputError = (field: string) => fieldErrors[field] || undefined;
  const describedBy = (field: string) => inputError(field) ? `customer-${field}-error` : undefined;
  const verifiedDate = dbdDefaults
    ? new Date(dbdDefaults.verifiedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
    : "";

  return (
    <>
      <form className="space-y-5" onSubmit={submit}>
        <fieldset className="space-y-2" disabled={isPending || Boolean(customer)}>
          <legend className="text-sm font-medium">ประเภทลูกค้า</legend>
          <RadioGroup
            className="flex flex-wrap gap-4"
            onValueChange={(next) => update("customerType", next as QuotationCustomerInput["customerType"])}
            value={value.customerType}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="customer-type-juristic" value="juristic" />
              <Label htmlFor="customer-type-juristic">นิติบุคคล</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="customer-type-individual" value="individual" />
              <Label htmlFor="customer-type-individual">บุคคลธรรมดา</Label>
            </div>
          </RadioGroup>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer-taxId">เลขประจำตัวผู้เสียภาษี</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-describedby={describedBy("taxId")}
                aria-invalid={Boolean(inputError("taxId"))}
                disabled={isPending || Boolean(customer)}
                id="customer-taxId"
                inputMode="numeric"
                maxLength={13}
                onChange={(event) => update("taxId", event.target.value)}
                pattern="[0-9]{13}"
                required
                value={value.taxId}
              />
              {value.customerType === "juristic" ? (
                <Button disabled={isPending} onClick={checkDbd} type="button" variant="outline">
                  {pendingOperation === "dbd" ? "กำลังตรวจสอบ DBD…" : customer ? "รีเฟรชจาก DBD" : "ตรวจสอบ DBD"}
                </Button>
              ) : null}
            </div>
            <FieldError id="customer-taxId-error" message={inputError("taxId")} />
            {customer ? <p className="text-xs text-muted-foreground">ประเภทลูกค้าและเลขผู้เสียภาษีเปลี่ยนไม่ได้หลังสร้าง Master</p> : null}
            {pendingOperation === "dbd" ? <p className="text-sm text-muted-foreground" role="status">กำลังตรวจสอบ DBD…</p> : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer-name">ชื่อลูกค้า</Label>
            <Input
              aria-describedby={describedBy("name")}
              aria-invalid={Boolean(inputError("name"))}
              disabled={isPending}
              id="customer-name"
              maxLength={200}
              onChange={(event) => update("name", event.target.value)}
              required
              value={value.name}
            />
            <FieldError id="customer-name-error" message={inputError("name")} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customer-address">ที่อยู่</Label>
            <Textarea
              aria-describedby={describedBy("address")}
              aria-invalid={Boolean(inputError("address"))}
              disabled={isPending}
              id="customer-address"
              maxLength={2000}
              onChange={(event) => update("address", event.target.value)}
              required
              rows={3}
              value={value.address}
            />
            <FieldError id="customer-address-error" message={inputError("address")} />
          </div>

          <fieldset className="space-y-2 sm:col-span-2" disabled={isPending}>
            <legend className="text-sm font-medium">สำนักงาน</legend>
            <RadioGroup
              className="flex flex-wrap gap-4"
              onValueChange={(next) => update("officeType", next as QuotationCustomerInput["officeType"])}
              value={value.officeType}
            >
              {[["head_office", "สำนักงานใหญ่"], ["branch", "สาขา"], ["unspecified", "ไม่ระบุ"]].map(([option, label]) => (
                <div className="flex items-center gap-2" key={option}>
                  <RadioGroupItem id={`customer-office-${option}`} value={option} />
                  <Label htmlFor={`customer-office-${option}`}>{label}</Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="customer-branchNumber">เลขสาขา</Label>
            <Input
              aria-describedby={describedBy("branchNumber")}
              aria-invalid={Boolean(inputError("branchNumber"))}
              disabled={isPending || value.officeType !== "branch"}
              id="customer-branchNumber"
              maxLength={200}
              onChange={(event) => update("branchNumber", event.target.value)}
              required={value.officeType === "branch"}
              value={value.officeType === "branch" ? value.branchNumber : ""}
            />
            <FieldError id="customer-branchNumber-error" message={inputError("branchNumber")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-contactName">ชื่อผู้ติดต่อ (ไม่บังคับ)</Label>
            <Input
              aria-describedby={describedBy("contactName")}
              aria-invalid={Boolean(inputError("contactName"))}
              disabled={isPending}
              id="customer-contactName"
              maxLength={200}
              onChange={(event) => update("contactName", event.target.value)}
              value={value.contactName}
            />
            <FieldError id="customer-contactName-error" message={inputError("contactName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-contactPhone">เบอร์โทร (ไม่บังคับ)</Label>
            <Input
              aria-describedby={describedBy("contactPhone")}
              aria-invalid={Boolean(inputError("contactPhone"))}
              disabled={isPending}
              id="customer-contactPhone"
              maxLength={200}
              onChange={(event) => update("contactPhone", event.target.value)}
              value={value.contactPhone}
            />
            <FieldError id="customer-contactPhone-error" message={inputError("contactPhone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-contactEmail">อีเมล (ไม่บังคับ)</Label>
            <Input
              aria-describedby={describedBy("contactEmail")}
              aria-invalid={Boolean(inputError("contactEmail"))}
              disabled={isPending}
              id="customer-contactEmail"
              maxLength={200}
              onChange={(event) => update("contactEmail", event.target.value)}
              type="email"
              value={value.contactEmail}
            />
            <FieldError id="customer-contactEmail-error" message={inputError("contactEmail")} />
          </div>
        </div>

        {value.customerType === "juristic" ? (
          <section aria-live="polite" className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium">สถานะ DBD</p>
              <p className="text-sm text-muted-foreground">
                {dbdDefaults ? `${dbdDefaults.status} · ตรวจสอบล่าสุด ${verifiedDate}` : "ยังไม่ยืนยันข้อมูล DBD"}
              </p>
            </div>
            {dbdDefaults ? (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">ชื่อจดทะเบียน</dt>
                  <dd className="break-words">{dbdDefaults.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ที่อยู่จดทะเบียน</dt>
                  <dd className="break-words">{dbdDefaults.address}</dd>
                </div>
              </dl>
            ) : null}
            {dbdDefaults && dbdDefaults.status !== "ยังดำเนินกิจการอยู่" ? (
              <p className="text-sm text-amber-700" role="alert">กรุณาตรวจสอบสถานะนิติบุคคลก่อนใช้งาน</p>
            ) : null}
            <Button
              disabled={isPending || !dbdDefaults || value.taxId !== dbdDefaults.taxId}
              onClick={resetFromDbd}
              size="sm"
              type="button"
              variant="outline"
            >
              รีเซ็ตเป็นข้อมูล DBD
            </Button>
          </section>
        ) : null}

        {existingCustomer ? (
          <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm" role="alert">
            <p className="font-medium">พบลูกค้าใน Master แล้ว</p>
            <p>{existingCustomer.name} · {existingCustomer.taxId}</p>
            <p>{existingCustomer.isActive ? "รายการนี้เปิดใช้งานอยู่" : "รายการนี้ปิดใช้งานอยู่"}</p>
            {!existingCustomer.isActive ? (
              <Button disabled={isPending} onClick={() => setConfirmReactivation(true)} size="sm" type="button" variant="outline">
                เปิดใช้งานรายการเดิม
              </Button>
            ) : null}
          </section>
        ) : null}
        {formError ? <p className="text-sm text-destructive" role="alert">{formError}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={isPending} onClick={onCancel} type="button" variant="outline">ยกเลิก</Button>
          <Button disabled={isPending} type="submit">{pendingOperation === "save" ? "กำลังบันทึก…" : "บันทึก"}</Button>
        </div>
      </form>

      <Dialog onOpenChange={(open) => !open && setConfirmUnverified(false)} open={confirmUnverified}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>บันทึกแบบยังไม่ยืนยัน</DialogTitle>
            <DialogDescription>
              ระบบตรวจสอบ DBD ไม่สำเร็จ ต้องการบันทึกลูกค้านี้แบบยังไม่ยืนยันหรือไม่
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={isPending} onClick={() => setConfirmUnverified(false)} type="button" variant="outline">ยกเลิก</Button>
            <Button disabled={isPending} onClick={() => { setConfirmUnverified(false); save(true); }} type="button">
              บันทึกแบบยังไม่ยืนยัน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setConfirmReactivation(false)} open={confirmReactivation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันเปิดใช้งานลูกค้าเดิม</DialogTitle>
            <DialogDescription>
              ต้องการเปิดใช้งาน {existingCustomer?.name ?? "ลูกค้าเดิม"} อีกครั้งใช่หรือไม่
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={isPending} onClick={() => setConfirmReactivation(false)} type="button" variant="outline">ยกเลิก</Button>
            <Button
              disabled={isPending}
              onClick={() => { setConfirmReactivation(false); reactivateExisting(); }}
              type="button"
            >
              {pendingOperation === "reactivate" ? "กำลังเปิดใช้งาน…" : "เปิดใช้งาน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
