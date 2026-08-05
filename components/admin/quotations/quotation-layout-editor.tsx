"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, GripVertical, History, Redo2, RotateCcw, Undo2 } from "lucide-react";
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
import { cn } from "../../../lib/utils";
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
  body: "เนื้อหาเอกสาร",
  certification: "การรับรอง",
  footer: "ท้ายเอกสาร",
  header: "ส่วนหัวเอกสาร",
  settlement: "สรุปและการชำระเงิน",
} as const;

const WIDTH_PRESETS = [
  { column: 1, label: "เต็มแถว", span: 12 },
  { column: 1, label: "กว้าง 2/3 ด้านซ้าย", span: 8 },
  { column: 1, label: "ครึ่งซ้าย", span: 6 },
  { column: 7, label: "ครึ่งขวา", span: 6 },
  { column: 9, label: "กว้าง 1/3 ด้านขวา", span: 4 },
] as const;

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
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function BlockPreview({ id }: { id: QuotationLayoutBlockId }) {
  switch (id) {
    case "seller": return <><p className="font-semibold text-slate-900">บริษัทตัวอย่าง จำกัด</p><p className="mt-1 text-[9px]">ที่อยู่ · โทรศัพท์ · เลขประจำตัวผู้เสียภาษี</p></>;
    case "documentMetadata": return <><p className="text-right text-xs font-semibold text-slate-900">ใบเสนอราคา</p><div className="mt-1 grid gap-0.5 text-[8px]"><p>เลขที่: QO-000001</p><p>วันที่ออก: 05/08/2026</p></div></>;
    case "customer": return <><p className="text-[9px] font-medium text-muted-foreground">เสนอให้</p><p className="mt-0.5 font-semibold text-slate-900">ชื่อลูกค้า / บริษัทลูกค้า</p><p className="mt-1 text-[9px]">ที่อยู่และข้อมูลผู้ติดต่อ</p></>;
    case "items": return <div className="overflow-hidden rounded border border-slate-200"><div className="grid grid-cols-[1fr_3rem_4.5rem] bg-slate-100 px-2 py-1 text-[8px] font-medium"><span>รายการ</span><span className="text-right">จำนวน</span><span className="text-right">ราคา</span></div><div className="grid grid-cols-[1fr_3rem_4.5rem] border-t px-2 py-1 text-[8px]"><span>รายละเอียดสินค้า/บริการ</span><span className="text-right">1</span><span className="text-right">0.00</span></div><div className="grid grid-cols-[1fr_3rem_4.5rem] border-t px-2 py-1 text-[8px]"><span>รายการเพิ่มเติม</span><span className="text-right">1</span><span className="text-right">0.00</span></div></div>;
    case "summary": return <div className="space-y-1 rounded bg-slate-900 p-2 text-[8px] text-white"><p className="font-semibold">สรุปยอด</p><p className="flex justify-between"><span>รวมทั้งสิ้น</span><span>0.00 บาท</span></p><p className="flex justify-between font-semibold"><span>ยอดชำระ</span><span>0.00 บาท</span></p></div>;
    case "paymentMethods": return <><p className="text-[9px] font-semibold text-slate-900">ช่องทางชำระเงิน</p><p className="mt-1 rounded bg-slate-100 px-2 py-1 text-[8px]">ธนาคาร · เลขที่บัญชี · PromptPay</p></>;
    case "publicNotes": return <><p className="text-[9px] font-semibold text-slate-900">หมายเหตุ</p><p className="mt-1 text-[8px] text-muted-foreground">ข้อความเพิ่มเติมบนเอกสารจะแสดงที่นี่</p></>;
    case "certification": return <div className="grid grid-cols-3 gap-2 text-center text-[8px]"><p className="border-t pt-3">ผู้ออกเอกสาร</p><p className="border-t pt-3">ผู้อนุมัติ</p><p className="border-t pt-3">ผู้รับเอกสาร</p></div>;
    case "sellerFooter": return <p className="text-[8px] text-muted-foreground">บริษัทตัวอย่าง จำกัด · ที่อยู่ · โทรศัพท์ · อีเมล</p>;
  }
}

function SortableLayoutBlock({ block, index, onSelect, selected }: { block: QuotationLayoutBlock; index: number; onSelect: (id: QuotationLayoutBlockId) => void; selected: boolean }) {
  const { handleRef, isDragging, ref } = useSortable({ group: `quotation-layout-${block.zone}`, id: block.id, index });
  return <div className={cn("relative min-h-20 min-w-0 cursor-pointer rounded-md border bg-white p-3 shadow-sm transition", selected ? "border-primary ring-2 ring-primary/20" : "border-slate-200 hover:border-primary/60", isDragging && "opacity-50")} data-layout-block={block.id} onClick={() => onSelect(block.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(block.id); } }} ref={ref} role="button" style={{ gridColumn: `${block.column} / span ${block.span}` }} tabIndex={0}>
    <div className="mb-2 flex items-center justify-between gap-2"><p className="min-w-0 truncate text-xs font-semibold text-slate-700">{BLOCK_LABELS[block.id]}</p><Button aria-label={`ลาก ${BLOCK_LABELS[block.id]} เพื่อเรียงลำดับ`} className="-mr-2 -mt-2 shrink-0 cursor-grab touch-none active:cursor-grabbing" onClick={(event) => event.stopPropagation()} ref={handleRef} size="icon-xs" type="button" variant="ghost"><GripVertical aria-hidden="true" /></Button></div><BlockPreview id={block.id} /></div>;
}

export function QuotationLayoutEditor({ initial, revisions, template }: { initial: QuotationDocumentTemplateSnapshot; revisions: QuotationDocumentTemplateRevision[]; template: QuotationTemplate }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => clone(initial.config));
  const [selectedId, setSelectedId] = useState<QuotationLayoutBlockId>(initial.config.blocks[0]?.id ?? "seller");
  const [undoStack, setUndoStack] = useState<QuotationLayoutConfig[]>([]);
  const [redoStack, setRedoStack] = useState<QuotationLayoutConfig[]>([]);
  const [isPending, startTransition] = useTransition();
  const changed = JSON.stringify(draft) !== JSON.stringify(initial.config);
  const selected = draft.blocks.find((block) => block.id === selectedId) ?? draft.blocks[0];

  function update(next: QuotationLayoutConfig) {
    if (!isQuotationLayoutConfig(next, template)) return;
    setUndoStack((current) => [...current.slice(-19), clone(draft)]);
    setRedoStack([]);
    setDraft(next);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, clone(draft)]);
    setDraft(clone(previous));
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, clone(draft)]);
    setDraft(clone(next));
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
    const neighbour = siblings[siblings.findIndex((item) => item.id === id) + direction];
    if (!neighbour) return;
    [block.order, neighbour.order] = [neighbour.order, block.order];
    update(next);
  }

  function reorderZone(zone: QuotationLayoutBlock["zone"], event: Parameters<typeof move>[1]) {
    const ordered = blocksInZone(draft, zone);
    const reordered = move(ordered, event) as QuotationLayoutBlock[];
    if (reordered.every((block, index) => block.id === ordered[index]?.id)) return;
    const next = clone(draft);
    const orderById = new Map(reordered.map((block, index) => [block.id, (index + 1) * 10]));
    for (const block of next.blocks) { const order = orderById.get(block.id); if (order !== undefined) block.order = order; }
    update(next);
  }

  function applyWidth(column: number, span: number) {
    if (!selected) return;
    const next = clone(draft);
    const block = next.blocks.find((item) => item.id === selected.id);
    if (!block) return;
    block.column = column;
    block.span = span;
    update(next);
  }

  function canMoveColumn(direction: -1 | 1) {
    if (!selected) return false;
    const next = clone(draft);
    const block = next.blocks.find((item) => item.id === selected.id);
    if (!block) return false;
    block.column += direction;
    return isQuotationLayoutConfig(next, template);
  }

  function canMoveOrder(direction: -1 | 1) {
    if (!selected) return false;
    const siblings = blocksInZone(draft, selected.zone);
    return Boolean(siblings[siblings.findIndex((item) => item.id === selected.id) + direction]);
  }

  function publish(config: QuotationLayoutConfig) {
    startTransition(async () => {
      const result = await publishQuotationDocumentTemplateLayoutAction(template, initial.revisionNumber, config);
      if (!result.ok) {
        toast.error(result.formError);
        return;
      }
      toast.success(`เผยแพร่เลเอาท์เวอร์ชัน ${result.revisionNumber} แล้ว`);
      router.refresh();
    });
  }

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]" data-quotation-layout-editor>
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 border-b bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">จัดหน้า {QUOTATION_TEMPLATE_LABELS[template]} · เวอร์ชัน {initial.revisionNumber}</CardTitle><p className="mt-1 text-sm font-normal text-muted-foreground">เลือกบล็อก หรือจับไอคอน <GripVertical aria-hidden="true" className="inline size-3" /> เพื่อลากเรียงลำดับในส่วนเดียวกัน</p></div><div className="flex gap-1"><Button aria-label="ย้อนกลับการแก้ไขล่าสุด" disabled={!undoStack.length || isPending} onClick={undo} size="icon-sm" type="button" variant="outline"><Undo2 aria-hidden="true" /></Button><Button aria-label="ทำซ้ำการแก้ไขล่าสุด" disabled={!redoStack.length || isPending} onClick={redo} size="icon-sm" type="button" variant="outline"><Redo2 aria-hidden="true" /></Button></div></div>
      </CardHeader>
      <CardContent className="bg-muted/20 p-4 sm:p-6"><div className="mx-auto grid w-full max-w-[210mm] gap-5 rounded-sm bg-white p-5 shadow-md ring-1 ring-border sm:p-7" data-layout-a4-canvas>
        {QUOTATION_LAYOUT_ZONES.map((zone) => { const blocks = blocksInZone(draft, zone); if (!blocks.length) return null; return <section className="grid gap-2" data-layout-zone={zone} key={zone}><div className="flex items-center gap-2"><span className="h-px flex-1 bg-slate-200" /><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{ZONE_LABELS[zone]}</p><span className="h-px flex-1 bg-slate-200" /></div><DragDropProvider onDragEnd={(event) => reorderZone(zone, event)}><div className="grid grid-cols-12 gap-2.5">{blocks.map((block, index) => <SortableLayoutBlock block={block} index={index} key={block.id} onSelect={setSelectedId} selected={selected?.id === block.id} />)}</div></DragDropProvider></section>; })}
      </div></CardContent>
    </Card>
    <aside className="grid content-start gap-4 xl:sticky xl:top-4 xl:self-start">
      {selected ? <Card><CardHeader className="pb-3"><p className="text-xs font-medium text-muted-foreground">กำลังเลือก</p><CardTitle className="text-base">{BLOCK_LABELS[selected.id]}</CardTitle><p className="text-sm font-normal text-muted-foreground">{ZONE_LABELS[selected.zone]} · {selected.span === 12 ? "เต็มแถว" : `ความกว้าง ${selected.span}/12`}</p></CardHeader><CardContent className="grid gap-4"><section><p className="mb-2 text-sm font-medium">ความกว้างและตำแหน่ง</p><div className="grid gap-2">{WIDTH_PRESETS.map((preset) => { const candidate = clone(draft); const block = candidate.blocks.find((item) => item.id === selected.id); if (!block) return null; block.column = preset.column; block.span = preset.span; const enabled = isQuotationLayoutConfig(candidate, template); return <Button className="justify-start" disabled={!enabled || isPending} key={preset.label} onClick={() => applyWidth(preset.column, preset.span)} size="sm" type="button" variant={selected.column === preset.column && selected.span === preset.span ? "default" : "outline"}>{preset.label}</Button>; })}</div></section><section><p className="mb-2 text-sm font-medium">เรียงลำดับในส่วนนี้</p><div className="grid grid-cols-2 gap-2"><Button disabled={isPending || !canMoveOrder(-1)} onClick={() => moveOrder(selected.id, -1)} size="sm" type="button" variant="outline"><ArrowUp aria-hidden="true" />ขึ้น</Button><Button disabled={isPending || !canMoveOrder(1)} onClick={() => moveOrder(selected.id, 1)} size="sm" type="button" variant="outline"><ArrowDown aria-hidden="true" />ลง</Button><Button disabled={isPending || !canMoveColumn(-1)} onClick={() => moveColumn(selected.id, -1)} size="sm" type="button" variant="outline"><ArrowLeft aria-hidden="true" />ซ้าย</Button><Button disabled={isPending || !canMoveColumn(1)} onClick={() => moveColumn(selected.id, 1)} size="sm" type="button" variant="outline"><ArrowRight aria-hidden="true" />ขวา</Button></div></section></CardContent></Card> : null}
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">เวอร์ชัน</CardTitle></CardHeader><CardContent className="grid gap-2">{revisions.map((revision) => <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm" key={revision.revisionNumber}><span><History aria-hidden="true" className="mr-1 inline size-3" />v{revision.revisionNumber}<span className="mt-0.5 block text-xs text-muted-foreground">ผู้ดูแล · {revisionTimestamp(revision.createdAt)}</span></span>{revision.revisionNumber === initial.revisionNumber ? <span className="text-xs text-muted-foreground">กำลังใช้</span> : <Button disabled={isPending} onClick={() => publish(revision.config)} size="sm" type="button" variant="ghost"><RotateCcw aria-hidden="true" />คืนค่า</Button>}</div>)}</CardContent></Card>
      <div className="flex flex-wrap gap-2"><Button disabled={isPending || !changed} onClick={() => { setDraft(clone(initial.config)); setUndoStack([]); setRedoStack([]); }} type="button" variant="outline">ยกเลิกการแก้ไข</Button><Button disabled={isPending || !changed} onClick={() => publish(draft)} type="button">{isPending ? "กำลังเผยแพร่…" : "เผยแพร่เลเอาท์"}</Button></div>
    </aside>
  </div>;
}
