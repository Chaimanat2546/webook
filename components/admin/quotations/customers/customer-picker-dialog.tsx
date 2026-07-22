"use client";

import { SearchIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";

import { searchActiveQuotationCustomersAction } from "../../../../app/admin/quotations/customers/actions";
import {
  quotationCustomerToSnapshot,
  type QuotationCustomerMaster,
} from "../../../../lib/quotation-customer-types";
import type { CustomerSnapshot } from "../../../../lib/quotation-types";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../ui/dialog";
import { Input } from "../../../ui/input";
import { QuotationCustomerForm } from "./customer-form";

export interface QuotationCustomerPickerDialogProps {
  current: CustomerSnapshot;
  onSelect: (snapshot: CustomerSnapshot) => void;
}

const snapshotFields = ["name", "address", "taxId", "officeType", "branchNumber"] as const;

export function QuotationCustomerPickerDialog({
  current,
  onSelect,
}: QuotationCustomerPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"create" | "list">("list");
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<QuotationCustomerMaster[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [pendingSnapshot, setPendingSnapshot] = useState<CustomerSnapshot | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setPendingSnapshot(null);
    setSearchError("");
    setView("list");
  }

  function apply(snapshot: CustomerSnapshot) {
    onSelect(snapshot);
    close();
  }

  function choose(customer: QuotationCustomerMaster) {
    const snapshot = quotationCustomerToSnapshot(customer);
    const hasDraft = snapshotFields.some((field) => String(current[field]).trim() !== "");
    const differs = snapshotFields.some((field) => current[field] !== snapshot[field]);
    if (hasDraft && differs) {
      setPendingSnapshot(snapshot);
      return;
    }
    apply(snapshot);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchError("");
    startTransition(async () => {
      const result = await searchActiveQuotationCustomersAction(query);
      setHasSearched(true);
      if (!result.ok) {
        setCustomers([]);
        setSearchError(result.formError);
        return;
      }
      setCustomers(result.items);
    });
  }

  return (
    <Dialog onOpenChange={(next) => { setOpen(next); if (!next) close(); }} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          <UsersIcon aria-hidden />
          เลือกลูกค้าจาก Master
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {pendingSnapshot ? (
          <>
            <DialogHeader>
              <DialogTitle>แทนที่ข้อมูลลูกค้า</DialogTitle>
              <DialogDescription>
                ข้อมูลลูกค้าในใบเสนอราคานี้จะถูกแทนที่ด้วยข้อมูลจาก Master ส่วนข้อมูล Master จะไม่เปลี่ยนแปลง
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{pendingSnapshot.name}</p>
              <p className="text-muted-foreground">{pendingSnapshot.taxId}</p>
              <p className="mt-2 whitespace-pre-line">{pendingSnapshot.address}</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setPendingSnapshot(null)} type="button" variant="outline">ยกเลิก</Button>
              <Button onClick={() => apply(pendingSnapshot)} type="button">แทนที่ข้อมูลลูกค้า</Button>
            </DialogFooter>
          </>
        ) : view === "create" ? (
          <>
            <DialogHeader>
              <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
              <DialogDescription>บันทึกเข้า Customer Master แล้วเลือกใช้กับใบเสนอราคานี้</DialogDescription>
            </DialogHeader>
            <QuotationCustomerForm customer={null} onCancel={() => setView("list")} onSaved={choose} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>เลือกลูกค้าจาก Master</DialogTitle>
              <DialogDescription>ค้นหาเฉพาะลูกค้าที่เปิดใช้งาน ข้อมูลจะถูกคัดลอกมาเป็น snapshot ของใบนี้</DialogDescription>
            </DialogHeader>
            <form className="flex gap-2" onSubmit={search}>
              <label className="sr-only" htmlFor="quotation-customer-picker-search">ค้นหาลูกค้า</label>
              <Input
                className="min-w-0 flex-1"
                id="quotation-customer-picker-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ชื่อหรือเลขผู้เสียภาษี"
                type="search"
                value={query}
              />
              <Button disabled={isPending} type="submit">
                <SearchIcon aria-hidden />
                {isPending ? "กำลังค้นหา…" : "ค้นหา"}
              </Button>
            </form>
            <Button className="w-full sm:w-auto" onClick={() => setView("create")} type="button" variant="outline">
              <UserPlusIcon aria-hidden />
              เพิ่มลูกค้าใหม่
            </Button>
            <div aria-live="polite" className="space-y-2">
              {searchError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                  {searchError}
                </p>
              ) : null}
              {customers.map((customer) => (
                <button
                  className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  key={customer.id}
                  onClick={() => choose(customer)}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="font-medium">{customer.name}</span>
                    <Badge variant="outline">{customer.customerType === "juristic" ? "นิติบุคคล" : "บุคคลธรรมดา"}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{customer.taxId}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{customer.address}</p>
                </button>
              ))}
              {hasSearched && !isPending && !searchError && customers.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">ไม่พบลูกค้าที่ค้นหา</p>
              ) : null}
              {!hasSearched ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">กรอกคำค้นหาแล้วกดค้นหา</p>
              ) : null}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
