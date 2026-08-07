"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import {
  quotationDocumentDisplayClearImpact,
  type QuotationDocumentDisplay,
  type QuotationDocumentDisplayKey,
} from "../../../lib/quotation-document-display";
import type { QuotationPayload } from "../../../lib/quotation-types";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { Separator } from "../../ui/separator";
import { Switch } from "../../ui/switch";

interface DisplayOption {
  description: string;
  key: QuotationDocumentDisplayKey;
  label: string;
}

const quotationOptions: DisplayOption[] = [
  { key: "reference", label: "อ้างอิงถึง", description: "แสดงช่องเลขอ้างอิง" },
  { key: "notes", label: "หมายเหตุ", description: "แสดงหมายเหตุบนเอกสาร" },
  { key: "discount", label: "ส่วนลด", description: "เปิดใช้ส่วนลดต่อรายการ" },
  { key: "unit", label: "หน่วย", description: "แสดงหน่วยของรายการ" },
  { key: "tax", label: "ภาษี", description: "เปิดใช้ VAT ต่อรายการ" },
  { key: "preTax", label: "มูลค่าก่อนภาษี", description: "แสดงยอดก่อนภาษี" },
  { key: "withholdingTax", label: "หัก ณ ที่จ่าย", description: "เปิดใช้ภาษีหัก ณ ที่จ่าย" },
];

const certificationOptions: DisplayOption[] = [
  { key: "certificationQr", label: "QR Code", description: "แสดง QR Code สำหรับเปิดเอกสารบนเว็บไซต์" },
  { key: "certificationDate", label: "วันที่", description: "แสดงวันที่ผู้ลงนามและช่องวันที่ลูกค้า" },
  { key: "certificationName", label: "ชื่อ", description: "แสดงชื่อผู้ออก ผู้อนุมัติ และลูกค้า" },
];

const labels = new Map(
  [...quotationOptions, ...certificationOptions].map(({ key, label }) => [key, label]),
);

export function QuotationDocumentDisplayDialog({
  disabled,
  onApply,
  payload,
}: {
  disabled: boolean;
  onApply: (value: QuotationDocumentDisplay, saveAsDefault: boolean) => Promise<boolean>;
  payload: QuotationPayload;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(payload.documentDisplay);
  const [pendingScope, setPendingScope] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const impact = quotationDocumentDisplayClearImpact(payload, draft);

  function changeOpen(next: boolean) {
    setOpen(next);
    setPendingScope(null);
    if (next) setDraft({ ...payload.documentDisplay });
  }

  async function apply(saveAsDefault: boolean) {
    if (impact.length && pendingScope === null) {
      setPendingScope(saveAsDefault);
      return;
    }
    setBusy(true);
    const applied = await onApply(draft, saveAsDefault);
    setBusy(false);
    if (applied) changeOpen(false);
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button disabled={disabled} size="sm" type="button" variant="outline">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          ตั้งค่ารูปแบบเอกสาร
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ตั้งค่ารูปแบบเอกสาร</DialogTitle>
          <DialogDescription>เลือกข้อมูลที่ต้องการแสดงในใบเสนอราคา</DialogDescription>
        </DialogHeader>
        {pendingScope === null ? (
          <div className="grid gap-5">
            <OptionSection options={quotationOptions} title="ข้อมูลใบเสนอราคา" />
            <Separator />
            <OptionSection options={certificationOptions} title="การรับรอง" />
          </div>
        ) : (
          <div className="grid gap-2 rounded-md border border-destructive/40 p-3">
            <p className="font-medium">ข้อมูลต่อไปนี้จะถูกล้าง</p>
            <p className="text-sm text-muted-foreground">
              {impact.map((key) => labels.get(key)).join(", ")}
            </p>
            <p className="text-sm">ยืนยันการเปลี่ยนแปลงหรือไม่</p>
          </div>
        )}
        <DialogFooter className="gap-2 sm:flex-col">
          {pendingScope === null ? (
            <>
              <Button disabled={busy} onClick={() => apply(false)} type="button" variant="outline">
                ใช้เฉพาะใบเสนอราคานี้
              </Button>
              <div className="grid gap-1">
                <Button disabled={busy} onClick={() => apply(true)} type="button">
                  บันทึกเป็นค่าเริ่มต้นทุกใบ
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  มีผลกับใบใหม่ในอนาคต ไม่เปลี่ยนใบที่บันทึกแล้ว
                </p>
              </div>
            </>
          ) : (
            <>
              <Button disabled={busy} onClick={() => setPendingScope(null)} type="button" variant="outline">
                ยกเลิก
              </Button>
              <Button disabled={busy} onClick={() => apply(pendingScope)} type="button" variant="destructive">
                ยืนยัน
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function OptionSection({ options, title }: { options: DisplayOption[]; title: string }) {
    return (
      <section className="grid gap-3">
        <h3 className="font-semibold">{title}</h3>
        {options.map((option) => (
          <div className="flex items-center justify-between gap-4" key={option.key}>
            <div>
              <p className="text-sm font-medium">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
            <Switch
              aria-label={option.label}
              checked={draft[option.key]}
              onCheckedChange={(checked) => setDraft((current) => ({ ...current, [option.key]: checked }))}
            />
          </div>
        ))}
      </section>
    );
  }
}
