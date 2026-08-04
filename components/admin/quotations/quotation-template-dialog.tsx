"use client";

import { useState } from "react";

import {
  QUOTATION_TEMPLATE_LABELS,
  QUOTATION_TEMPLATES,
  type QuotationTemplate,
} from "../../../lib/quotation-template";
import { cn } from "../../../lib/utils";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { QuotationTemplateThumbnail } from "./quotation-template-thumbnail";

export interface QuotationTemplateDialogProps {
  accountDefault: QuotationTemplate;
  disabled: boolean;
  onApply: (
    value: QuotationTemplate,
    saveAsDefault: boolean,
  ) => Promise<boolean>;
  value: QuotationTemplate;
}

export function QuotationTemplateDialog({
  accountDefault,
  disabled,
  onApply,
  value,
}: QuotationTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) setDraft(value);
  }

  async function apply(saveAsDefault: boolean) {
    setBusy(true);
    try {
      const applied = await onApply(draft, saveAsDefault);
      if (applied) changeOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button disabled={disabled} size="sm" type="button" variant="outline">
          เลือกเทมเพลต
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>เลือกเทมเพลตใบเสนอราคา</DialogTitle>
          <DialogDescription>
            เลือกรูปแบบสำหรับใบเสนอราคานี้ หรือบันทึกเป็นค่าเริ่มต้นของบัญชี
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label="เทมเพลตใบเสนอราคา"
          className="grid gap-3 sm:grid-cols-3"
          disabled={busy}
          onValueChange={(next) => setDraft(next as QuotationTemplate)}
          value={draft}
        >
          {QUOTATION_TEMPLATES.map((template) => {
            const inputId = `quotation-template-${template}`;
            const selected = draft === template;
            return (
              <label className="block cursor-pointer" htmlFor={inputId} key={template}>
                <Card
                  className={cn(
                    "overflow-hidden border transition-colors focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/50",
                    selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <CardContent className="grid gap-3 p-3">
                    <QuotationTemplateThumbnail template={template} />
                    <span className="flex items-start gap-2">
                      <RadioGroupItem disabled={busy} id={inputId} value={template} />
                    <span className="grid min-w-0 gap-1">
                      <span className="font-medium">{QUOTATION_TEMPLATE_LABELS[template]}</span>
                      <span className="flex flex-wrap gap-1">
                        {value === template ? <Badge variant="secondary">กำลังใช้</Badge> : null}
                        {accountDefault === template ? (
                          <Badge variant="outline">ค่าเริ่มต้นของบัญชี</Badge>
                        ) : null}
                      </span>
                    </span>
                    </span>
                  </CardContent>
                </Card>
              </label>
            );
          })}
        </RadioGroup>
        <DialogFooter className="gap-2 sm:flex-col">
          <Button disabled={busy} onClick={() => apply(false)} type="button" variant="outline">
            ใช้เฉพาะใบเสนอราคานี้
          </Button>
          <div className="grid gap-1">
            <Button disabled={busy} onClick={() => apply(true)} type="button">
              ใช้และบันทึกเป็นค่าเริ่มต้น
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              มีผลกับใบใหม่ในอนาคต ไม่เปลี่ยนใบที่บันทึกแล้ว
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
