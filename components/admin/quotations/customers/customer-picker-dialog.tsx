"use client";

import { UserPlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { searchActiveQuotationCustomersAction } from "../../../../app/admin/quotations/customers/actions";
import {
  quotationCustomerToSnapshot,
  type QuotationCustomerMaster,
} from "../../../../lib/quotation-customer-types";
import type { CustomerSnapshot } from "../../../../lib/quotation-types";
import { Button } from "../../../ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../../../ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../ui/dialog";
import { QuotationCustomerForm } from "./customer-form";

export interface QuotationCustomerPickerProps {
  current: CustomerSnapshot;
  error?: string;
  onSelect: (snapshot: CustomerSnapshot) => void;
}

const snapshotFields = ["name", "address", "taxId", "officeType", "branchNumber"] as const;

function officeLabel(customer: Pick<CustomerSnapshot, "branchNumber" | "officeType">) {
  if (customer.officeType === "branch") return `สาขา ${customer.branchNumber}`;
  return customer.officeType === "head_office" ? "สำนักงานใหญ่" : "ไม่ระบุ";
}

export function QuotationCustomerPicker({
  current,
  error,
  onSelect,
}: QuotationCustomerPickerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [customers, setCustomers] = useState<QuotationCustomerMaster[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<CustomerSnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const requestIdRef = useRef(0);
  const hasCurrent = current.name.trim() !== "" || current.taxId.trim() !== "";

  const loadCustomers = useCallback(async (search: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSearchError("");
    try {
      const result = await searchActiveQuotationCustomersAction(search);
      if (requestId !== requestIdRef.current) return;
      setHasLoaded(true);
      if (!result.ok) {
        setCustomers([]);
        setSearchError(result.formError);
        return;
      }
      setCustomers(result.items);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setCustomers([]);
      setHasLoaded(true);
      setSearchError("ไม่สามารถค้นหาลูกค้าได้ กรุณาลองอีกครั้ง");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    requestIdRef.current += 1;
    const search = query.trim();
    if (search.length === 1) return;
    const timeoutId = window.setTimeout(
      () => void loadCustomers(search),
      search.length >= 2 ? 250 : 0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [loadCustomers, open, query]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      requestIdRef.current += 1;
      setCustomers([]);
      setHasLoaded(false);
      setLoading(false);
      setQuery("");
      setSearchError("");
    }
  }

  function changeQuery(next: string) {
    setQuery(next);
    if (next.trim().length !== 1) return;
    requestIdRef.current += 1;
    setCustomers([]);
    setHasLoaded(false);
    setLoading(false);
    setSearchError("");
  }

  function apply(snapshot: CustomerSnapshot) {
    onSelect(snapshot);
    setOpen(false);
    setPendingSnapshot(null);
    setQuery("");
  }

  function choose(customer: QuotationCustomerMaster) {
    const snapshot = quotationCustomerToSnapshot(customer);
    const differs = snapshotFields.some((field) => current[field] !== snapshot[field]);
    if (hasCurrent && differs) {
      setPendingSnapshot(snapshot);
      return;
    }
    apply(snapshot);
  }

  return (
    <>
      <div className="space-y-2">
        <Combobox
          filter={null}
          inputValue={open ? query : current.name}
          itemToStringLabel={(customer: QuotationCustomerMaster) => customer.name}
          itemToStringValue={(customer: QuotationCustomerMaster) => customer.name}
          items={customers}
          onInputValueChange={(value, eventDetails) => {
            if (eventDetails.reason === "input-change") changeQuery(value);
          }}
          onOpenChange={(next) => changeOpen(next)}
          onValueChange={(customer: QuotationCustomerMaster | null) => {
            if (customer) choose(customer);
          }}
          open={open}
        >
            <ComboboxInput
              aria-label="ลูกค้า"
              aria-describedby={error ? "quotation-customer-error" : undefined}
              aria-invalid={Boolean(error)}
              className="w-full"
              data-field="customer.name"
              placeholder="ค้นหาชื่อหรือเลขประจำตัวผู้เสียภาษี"
            />
            <ComboboxContent>
              {loading ? (
                <p className="p-3 text-sm text-muted-foreground" role="status">
                  กำลังโหลดลูกค้า…
                </p>
              ) : null}
              {!loading && query.trim().length === 1 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  พิมพ์อย่างน้อย 2 ตัวอักษร
                </p>
              ) : null}
              {!loading && searchError ? (
                <div className="space-y-2 p-3" role="alert">
                  <p className="text-sm text-destructive">{searchError}</p>
                  <Button
                    onClick={() => void loadCustomers(query.trim())}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    ลองใหม่
                  </Button>
                </div>
              ) : null}
              {!loading && !searchError && query.trim().length !== 1 ? (
                <ComboboxList>
                  {(customer: QuotationCustomerMaster) => (
                    <ComboboxItem key={customer.id} value={customer}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{customer.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {customer.taxId} · {officeLabel(customer)}
                        </span>
                      </span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              ) : null}
              {!loading && !searchError && hasLoaded && customers.length === 0 ? (
                <div className="space-y-2 p-3">
                  <p className="text-sm text-muted-foreground">ไม่พบลูกค้า</p>
                  <Button
                    onClick={() => {
                      setOpen(false);
                      setCreateOpen(true);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <UserPlusIcon aria-hidden />
                    เพิ่มลูกค้าใหม่
                  </Button>
                </div>
              ) : null}
            </ComboboxContent>
        </Combobox>
        {hasCurrent ? (
          <div
            className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm"
            data-selected-customer-details
          >
            <p className="font-mono text-xs text-muted-foreground">{current.taxId}</p>
            <p className="text-muted-foreground">{officeLabel(current)}</p>
            <p className="whitespace-pre-line">{current.address}</p>
          </div>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive" id="quotation-customer-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <Dialog
        onOpenChange={(next) => {
          if (!next) setPendingSnapshot(null);
        }}
        open={pendingSnapshot !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แทนที่ข้อมูลลูกค้า</DialogTitle>
            <DialogDescription>
              ข้อมูลลูกค้าในใบเสนอราคานี้จะถูกแทนที่ด้วยข้อมูลจากข้อมูลลูกค้า
              ส่วนข้อมูลลูกค้าต้นทางจะไม่เปลี่ยนแปลง
            </DialogDescription>
          </DialogHeader>
          {pendingSnapshot ? (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{pendingSnapshot.name}</p>
              <p className="text-muted-foreground">{pendingSnapshot.taxId}</p>
              <p className="mt-2 whitespace-pre-line">{pendingSnapshot.address}</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setPendingSnapshot(null)} type="button" variant="outline">
              ยกเลิก
            </Button>
            <Button
              disabled={!pendingSnapshot}
              onClick={() => {
                if (pendingSnapshot) apply(pendingSnapshot);
              }}
              type="button"
            >
              แทนที่ข้อมูลลูกค้า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
            <DialogDescription>
              บันทึกเข้าข้อมูลลูกค้าก่อนเลือกใช้กับใบเสนอราคานี้
            </DialogDescription>
          </DialogHeader>
          <QuotationCustomerForm
            customer={null}
            onCancel={() => setCreateOpen(false)}
            onSaved={(customer) => {
              setCreateOpen(false);
              choose(customer);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
