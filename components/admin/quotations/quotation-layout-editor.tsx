"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, History, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { publishQuotationDocumentTemplateLayoutAction } from "../../../app/admin/quotations/actions";
import {
  isQuotationLayoutConfig,
  QUOTATION_LAYOUT_ZONES,
  type QuotationLayoutBlock,
  type QuotationLayoutBlockId,
  type QuotationLayoutConfig,
} from "../../../lib/quotation-layout";
import { QUOTATION_TEMPLATE_LABELS, type QuotationTemplate } from "../../../lib/quotation-template";
import type {
  QuotationDocumentTemplateRevision,
  QuotationDocumentTemplateSnapshot,
} from "../../../server/repositories/quotations";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";

const BLOCK_LABELS: Record<QuotationLayoutBlockId, string> = {
  certification: "การรับรอง",
  customer: "ข้อมูลลูกค้า",
  documentMetadata: "ข้อมูลเอกสาร",
  items: "ตารางรายการ",
  paymentMethods: "ช่องทางชำระเงิน",
  publicNotes: "หมายเหตุบนเอกสาร",
  seller: "ข้อมูลผู้ขาย",
  sellerFooter: "ข้อมูลท้ายเอกสาร",
  summary: "สรุปยอด",
};

const ZONE_LABELS = {
  body: "เนื้อหา",
  certification: "การรับรอง",
  footer: "ท้ายเอกสาร",
  header: "ส่วนหัว",
  settlement: "สรุปและการชำระเงิน",
} as const;

function clone(config: QuotationLayoutConfig): QuotationLayoutConfig {
  return structuredClone(config);
}

function blocksInZone(config: QuotationLayoutConfig, zone: QuotationLayoutBlock["zone"]) {
  return config.blocks
    .filter((block) => block.zone === zone)
    .sort((left, right) => left.order - right.order || left.column - right.column);
}

function revisionTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ไม่ทราบเวลา";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function QuotationLayoutEditor({
  initial,
  revisions,
  template,
}: {
  initial: QuotationDocumentTemplateSnapshot;
  revisions: QuotationDocumentTemplateRevision[];
  template: QuotationTemplate;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => clone(initial.config));
  const [isPending, startTransition] = useTransition();
  const changed = JSON.stringify(draft) !== JSON.stringify(initial.config);
  const valid = isQuotationLayoutConfig(draft, template);

  function update(next: QuotationLayoutConfig) {
    if (!isQuotationLayoutConfig(next, template)) return;
    setDraft(next);
  }

  function moveColumn(id: QuotationLayoutBlockId, direction: -1 | 1) {
    const next = clone(draft);
    const block = next.blocks.find((item) => item.id === id);
    if (!block) return;
    block.column += direction;
    update(next);
  }

  function moveOrder(id: QuotationLayoutBlockId, direction: -1 | 1) {
    const next = clone(draft);
    const block = next.blocks.find((item) => item.id === id);
    if (!block) return;
    const siblings = blocksInZone(next, block.zone);
    const index = siblings.findIndex((item) => item.id === id);
    const neighbour = siblings[index + direction];
    if (!neighbour) return;
    const order = block.order;
    block.order = neighbour.order;
    neighbour.order = order;
    update(next);
  }

  function canMoveColumn(block: QuotationLayoutBlock, direction: -1 | 1) {
    const next = clone(draft);
    const current = next.blocks.find((item) => item.id === block.id);
    if (!current) return false;
    current.column += direction;
    return isQuotationLayoutConfig(next, template);
  }

  function canMoveOrder(block: QuotationLayoutBlock, direction: -1 | 1) {
    const siblings = blocksInZone(draft, block.zone);
    return Boolean(siblings[siblings.findIndex((item) => item.id === block.id) + direction]);
  }

  function publish(config: QuotationLayoutConfig) {
    startTransition(async () => {
      const result = await publishQuotationDocumentTemplateLayoutAction(
        template,
        initial.revisionNumber,
        config,
      );
      if (!result.ok) {
        toast.error(result.formError);
        return;
      }
      toast.success(`เผยแพร่เลเอาท์เวอร์ชัน ${result.revisionNumber} แล้ว`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]" data-quotation-layout-editor>
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base">ผัง {QUOTATION_TEMPLATE_LABELS[template]} · เวอร์ชัน {initial.revisionNumber}</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">แก้ตำแหน่งเชิงโครงสร้างในกริด 12 คอลัมน์ โดยไม่รับ CSS หรือ HTML</p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-4 sm:p-6">
          <div className="mx-auto grid min-w-[42rem] max-w-[210mm] gap-4 rounded-md bg-white p-5 shadow-sm ring-1 ring-border" data-layout-a4-canvas>
            {QUOTATION_LAYOUT_ZONES.map((zone) => {
              const blocks = blocksInZone(draft, zone);
              if (!blocks.length) return null;
              return <section className="grid gap-2" data-layout-zone={zone} key={zone}>
                <p className="text-xs font-semibold text-muted-foreground">{ZONE_LABELS[zone]}</p>
                <div className="grid grid-cols-12 gap-2">
                  {blocks.map((block) => <div
                    className="min-h-16 rounded border border-primary/30 bg-primary/5 p-3 text-sm shadow-sm"
                    data-layout-block={block.id}
                    key={block.id}
                    style={{ gridColumn: `${block.column} / span ${block.span}` }}
                  >
                    <p className="font-medium">{BLOCK_LABELS[block.id]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">คอลัมน์ {block.column} · กว้าง {block.span}/12</p>
                  </div>)}
                </div>
              </section>;
            })}
          </div>
        </CardContent>
      </Card>

      <aside className="grid content-start gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">จัดตำแหน่งบล็อก</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {draft.blocks.map((block) => <section className="grid gap-2 rounded-md border p-3" key={block.id}>
              <p className="font-medium">{BLOCK_LABELS[block.id]}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button aria-label={`เลื่อน ${BLOCK_LABELS[block.id]} ขึ้น`} disabled={isPending || !canMoveOrder(block, -1)} onClick={() => moveOrder(block.id, -1)} size="sm" type="button" variant="outline"><ArrowUp aria-hidden="true" />ขึ้น</Button>
                <Button aria-label={`เลื่อน ${BLOCK_LABELS[block.id]} ลง`} disabled={isPending || !canMoveOrder(block, 1)} onClick={() => moveOrder(block.id, 1)} size="sm" type="button" variant="outline"><ArrowDown aria-hidden="true" />ลง</Button>
                <Button aria-label={`เลื่อน ${BLOCK_LABELS[block.id]} ไปซ้าย`} disabled={isPending || !canMoveColumn(block, -1)} onClick={() => moveColumn(block.id, -1)} size="sm" type="button" variant="outline"><ArrowLeft aria-hidden="true" />ซ้าย</Button>
                <Button aria-label={`เลื่อน ${BLOCK_LABELS[block.id]} ไปขวา`} disabled={isPending || !canMoveColumn(block, 1)} onClick={() => moveColumn(block.id, 1)} size="sm" type="button" variant="outline"><ArrowRight aria-hidden="true" />ขวา</Button>
              </div>
            </section>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">ประวัติเวอร์ชัน</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {revisions.map((revision) => <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm" key={revision.revisionNumber}>
              <span><History aria-hidden="true" className="mr-1 inline size-3" />v{revision.revisionNumber}<span className="mt-0.5 block text-xs text-muted-foreground">ผู้ดูแล · {revisionTimestamp(revision.createdAt)}</span></span>
              {revision.revisionNumber === initial.revisionNumber ? <span className="text-xs text-muted-foreground">กำลังใช้</span> : <Button disabled={isPending} onClick={() => publish(revision.config)} size="sm" type="button" variant="ghost"><RotateCcw aria-hidden="true" />คืนค่า</Button>}
            </div>)}
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isPending || !changed} onClick={() => setDraft(clone(initial.config))} type="button" variant="outline">ยกเลิกการแก้ไข</Button>
          <Button disabled={isPending || !changed || !valid} onClick={() => publish(draft)} type="button">{isPending ? "กำลังเผยแพร่…" : "เผยแพร่เลเอาท์"}</Button>
        </div>
      </aside>
    </div>
  );
}
