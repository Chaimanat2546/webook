"use client";

import {
  EllipsisVerticalIcon,
  PencilLineIcon,
  PlusIcon,
  PowerIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setQuotationCustomerActiveAction } from "../../../../app/admin/quotations/customers/actions";
import type { QuotationCustomerMaster } from "../../../../lib/quotation-customer-types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/table";
import { QuotationCustomerForm } from "./customer-form";

function customerTypeLabel(customer: QuotationCustomerMaster): string {
  return customer.customerType === "juristic" ? "นิติบุคคล" : "บุคคลธรรมดา";
}

function officeLabel(customer: QuotationCustomerMaster): string {
  if (customer.officeType === "branch") return `สาขา ${customer.branchNumber}`;
  if (customer.officeType === "head_office") return "สำนักงานใหญ่";
  return "ไม่ระบุ";
}

function contactSummary(customer: QuotationCustomerMaster): string {
  return [customer.contactName, customer.contactPhone, customer.contactEmail].filter(Boolean).join(" · ") || "-";
}

function DbdState({ customer }: { customer: QuotationCustomerMaster }) {
  if (customer.customerType === "individual") return <span className="text-muted-foreground">ไม่ใช้ DBD</span>;
  if (!customer.dbdVerifiedAt) return <Badge variant="outline">ยังไม่ยืนยัน</Badge>;
  const date = new Date(customer.dbdVerifiedAt);
  return (
    <div className="space-y-1">
      <Badge variant="secondary">ยืนยันแล้ว</Badge>
      <p className="text-xs text-muted-foreground">
        {Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH")}
      </p>
    </div>
  );
}

function CustomerActions({
  customer,
  onEdit,
  onToggle,
}: {
  customer: QuotationCustomerMaster;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`เปิดเมนูจัดการ ${customer.name}`} size="icon" type="button" variant="outline">
          <EllipsisVerticalIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onEdit}>
            <PencilLineIcon aria-hidden />
            แก้ไข
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggle} variant={customer.isActive ? "destructive" : "default"}>
            {customer.isActive ? <PowerIcon aria-hidden /> : <RotateCcwIcon aria-hidden />}
            {customer.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function QuotationCustomerList({
  customers,
}: {
  customers: QuotationCustomerMaster[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<QuotationCustomerMaster | null | undefined>(undefined);
  const [toggleCustomer, setToggleCustomer] = useState<QuotationCustomerMaster | null>(null);
  const [toggleError, setToggleError] = useState("");
  const [isPending, startTransition] = useTransition();

  function finishSaved() {
    setEditing(undefined);
    router.refresh();
  }

  function confirmToggle() {
    if (!toggleCustomer) return;
    setToggleError("");
    startTransition(async () => {
      const result = await setQuotationCustomerActiveAction(toggleCustomer.id, !toggleCustomer.isActive);
      if (!result.ok) {
        setToggleError(result.formError);
        return;
      }
      toast.success(toggleCustomer.isActive ? "ปิดใช้งานลูกค้าแล้ว" : "เปิดใช้งานลูกค้าแล้ว");
      setToggleCustomer(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEditing(null)} type="button">
          <PlusIcon aria-hidden />
          เพิ่มลูกค้า
        </Button>
      </div>

      {customers.length ? <div className="space-y-3 md:hidden">
        {customers.map((customer) => (
          <Card key={customer.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <CardTitle className="break-words text-base">{customer.name}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{customerTypeLabel(customer)}</Badge>
                  <Badge variant="secondary">{officeLabel(customer)}</Badge>
                </div>
              </div>
              <CustomerActions customer={customer} onEdit={() => setEditing(customer)} onToggle={() => setToggleCustomer(customer)} />
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-muted-foreground">เลขผู้เสียภาษี</dt><dd className="font-mono">{customer.taxId}</dd></div>
                <div><dt className="text-muted-foreground">ผู้ติดต่อ</dt><dd className="break-words">{contactSummary(customer)}</dd></div>
                <div><dt className="text-muted-foreground">DBD</dt><dd><DbdState customer={customer} /></dd></div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div> : null}

      {customers.length ? <Card className="hidden overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ลูกค้า</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>เลขผู้เสียภาษี</TableHead>
              <TableHead>สำนักงาน</TableHead>
              <TableHead>ผู้ติดต่อ</TableHead>
              <TableHead>DBD</TableHead>
              <TableHead><span className="sr-only">การจัดการ</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="max-w-60 whitespace-normal font-medium">{customer.name}</TableCell>
                <TableCell><Badge variant="outline">{customerTypeLabel(customer)}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{customer.taxId}</TableCell>
                <TableCell>{officeLabel(customer)}</TableCell>
                <TableCell className="max-w-64 whitespace-normal text-sm">{contactSummary(customer)}</TableCell>
                <TableCell><DbdState customer={customer} /></TableCell>
                <TableCell className="text-right">
                  <CustomerActions customer={customer} onEdit={() => setEditing(customer)} onToggle={() => setToggleCustomer(customer)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card> : null}

      <Dialog onOpenChange={(open) => !open && setEditing(undefined)} open={editing !== undefined}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มลูกค้า"}</DialogTitle>
            <DialogDescription>ข้อมูลผู้ติดต่อเก็บเฉพาะใน Customer Master และไม่แสดงในใบเสนอราคา</DialogDescription>
          </DialogHeader>
          <QuotationCustomerForm
            customer={editing ?? null}
            key={editing?.id ?? "new"}
            onCancel={() => setEditing(undefined)}
            onSaved={finishSaved}
          />
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setToggleCustomer(null)} open={toggleCustomer !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{toggleCustomer?.isActive ? "ปิดใช้งานลูกค้า" : "เปิดใช้งานลูกค้า"}</DialogTitle>
            <DialogDescription>
              {toggleCustomer?.isActive
                ? `ต้องการปิดใช้งาน ${toggleCustomer.name} ใช่หรือไม่ ลูกค้าเดิมในใบเสนอราคาจะไม่เปลี่ยนแปลง`
                : `ต้องการเปิดใช้งาน ${toggleCustomer?.name ?? "ลูกค้า"} อีกครั้งใช่หรือไม่`}
            </DialogDescription>
          </DialogHeader>
          {toggleError ? <p className="text-sm text-destructive" role="alert">{toggleError}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={isPending} onClick={() => setToggleCustomer(null)} type="button" variant="outline">ยกเลิก</Button>
            <Button disabled={isPending} onClick={confirmToggle} type="button" variant={toggleCustomer?.isActive ? "destructive" : "default"}>
              {isPending ? "กำลังบันทึก…" : toggleCustomer?.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
