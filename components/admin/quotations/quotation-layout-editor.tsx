"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  History,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { publishQuotationDocumentTemplateLayoutAction } from "../../../app/admin/quotations/actions";
import {
  isQuotationLayoutConfig,
  quotationLayoutBlockRow,
  quotationLayoutBlockRowSpan,
  quotationLayoutZonesInDocumentOrder,
  type QuotationLayoutBlock,
  type QuotationLayoutBlockId,
  type QuotationLayoutConfig,
} from "../../../lib/quotation-layout";
import {
  QUOTATION_TEMPLATE_LABELS,
  type QuotationTemplate,
} from "../../../lib/quotation-template";
import { quotationThemePalette } from "../../../lib/quotation-theme";
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

type LayoutMoveDirection = "down" | "left" | "right" | "up";

const TEMPLATE_CANVAS = {
  corporate: { frame: "bg-white text-slate-800", name: "Corporate" },
  current: { frame: "bg-white text-slate-900", name: "Current" },
  hospitality: { frame: "bg-[#fffdf8] text-slate-800", name: "Hospitality" },
} as const;

function clone(config: QuotationLayoutConfig): QuotationLayoutConfig {
  return structuredClone(config);
}

function blocksInZone(
  config: QuotationLayoutConfig,
  zone: QuotationLayoutBlock["zone"],
) {
  return config.blocks
    .filter((block) => block.zone === zone)
    .sort(
      (left, right) => left.order - right.order || left.column - right.column,
    );
}

function revisionTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ไม่ทราบเวลา";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function BlockPreview({
  id,
  template,
  themeColor,
}: {
  id: QuotationLayoutBlockId;
  template: QuotationTemplate;
  themeColor: string;
}) {
  const isCorporate = template === "corporate";
  const isHospitality = template === "hospitality";
  const palette = quotationThemePalette(themeColor);
  switch (id) {
    case "seller":
      return (
        <>
          <p className="font-semibold" style={{ color: palette.primary }}>
            บริษัทตัวอย่าง จำกัด
          </p>
          <p className="mt-1 text-[9px]">
            ที่อยู่ · โทรศัพท์ · เลขประจำตัวผู้เสียภาษี
          </p>
        </>
      );
    case "documentMetadata":
      return (
        <>
          <p
            className="text-right text-xs font-semibold"
            style={{ color: palette.primary }}
          >
            {isCorporate || isHospitality ? "QUOTATION" : "ใบเสนอราคา"}
          </p>
          <div
            className="mt-1 grid gap-0.5 rounded border p-1.5 text-[8px]"
            style={{
              backgroundColor: palette.light,
              borderColor: palette.border,
            }}
          >
            <p>เลขที่: QO-000001</p>
            <p>วันที่ออก: 05/08/2026</p>
          </div>
        </>
      );
    case "customer":
      return (
        <>
          <p
            className="text-[9px] font-medium"
            style={{ color: palette.primary }}
          >
            {isHospitality
              ? "สำหรับ"
              : isCorporate
                ? "ผู้รับใบเสนอราคา"
                : "เสนอให้"}
          </p>
          <p className="mt-0.5 font-semibold text-slate-900">
            ชื่อลูกค้า / บริษัทลูกค้า
          </p>
          <p className="mt-1 text-[9px]">ที่อยู่และข้อมูลผู้ติดต่อ</p>
        </>
      );
    case "items":
      return (
        <div
          className="overflow-hidden rounded border"
          style={{ borderColor: palette.border }}
        >
          <div
            className="grid grid-cols-[1fr_3rem_4.5rem] px-2 py-1 text-[8px] font-medium"
            style={{
              backgroundColor: palette.primary,
              color: palette.contrast,
            }}
          >
            <span>{isHospitality ? "รายละเอียดที่พัก/บริการ" : "รายการ"}</span>
            <span className="text-right">จำนวน</span>
            <span className="text-right">ราคา</span>
          </div>
          <div className="grid grid-cols-[1fr_3rem_4.5rem] border-t px-2 py-1 text-[8px]">
            <span>รายละเอียดสินค้า/บริการ</span>
            <span className="text-right">1</span>
            <span className="text-right">0.00</span>
          </div>
          <div className="grid grid-cols-[1fr_3rem_4.5rem] border-t px-2 py-1 text-[8px]">
            <span>รายการเพิ่มเติม</span>
            <span className="text-right">1</span>
            <span className="text-right">0.00</span>
          </div>
        </div>
      );
    case "summary":
      return isCorporate || isHospitality ? (
        <div
          className="space-y-1 rounded p-2 text-[8px]"
          style={{ backgroundColor: palette.primary, color: palette.contrast }}
        >
          <p className="font-semibold">สรุปการชำระ</p>
          <p className="flex justify-between">
            <span>รวมทั้งสิ้น</span>
            <span>0.00 บาท</span>
          </p>
          <p className="flex justify-between font-semibold">
            <span>ยอดชำระ</span>
            <span>0.00 บาท</span>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_9rem] gap-2 text-[8px]">
          <p className="font-semibold text-slate-700">สรุป</p>
          <div className="space-y-0.5">
            <p className="flex justify-between">
              <span>มูลค่าก่อนภาษี</span>
              <span>12,000.00 บาท</span>
            </p>
            <p className="flex justify-between">
              <span>ภาษีมูลค่าเพิ่ม</span>
              <span>840.00 บาท</span>
            </p>
            <p className="flex justify-between">
              <span>จำนวนเงินทั้งสิ้น</span>
              <span>หนึ่งหมื่นสองพันแปดร้อยสี่สิบบาทถ้วน</span>
            </p>
          </div>
          <div
            className="rounded-md p-2"
            style={{ backgroundColor: palette.light }}
          >
            <p
              className="flex justify-between font-semibold"
              style={{ color: palette.dark }}
            >
              <span>จำนวนเงินทั้งสิ้น</span>
              <span>12,840.00 บาท</span>
            </p>
            <p className="mt-2 flex justify-between">
              <span>หักภาษี ณ ที่จ่าย</span>
              <span>0.00 บาท</span>
            </p>
            <p className="flex justify-between">
              <span>จำนวนเงินที่ชำระ</span>
              <span>12,840.00 บาท</span>
            </p>
          </div>
        </div>
      );
    case "paymentMethods":
      return (
        <>
          <p
            className="text-[9px] font-semibold"
            style={{ color: palette.primary }}
          >
            {isCorporate || isHospitality ? "การชำระเงิน" : "ช่องทางชำระเงิน"}
          </p>
          <p
            className="mt-1 rounded px-2 py-1 text-[8px]"
            style={{ backgroundColor: palette.light }}
          >
            ธนาคาร · เลขที่บัญชี · PromptPay
          </p>
        </>
      );
    case "publicNotes":
      return (
        <>
          <p
            className="text-[9px] font-semibold"
            style={{ color: palette.primary }}
          >
            หมายเหตุ
          </p>
          <p className="mt-1 text-[8px] text-muted-foreground">
            ข้อความเพิ่มเติมบนเอกสารจะแสดงที่นี่
          </p>
        </>
      );
    case "certification":
      return (
        <div className="grid grid-cols-3 gap-2 text-center text-[8px]">
          <p className="border-t pt-3">ผู้ออกเอกสาร</p>
          <p className="border-t pt-3">ผู้อนุมัติ</p>
          <p className="border-t pt-3">ผู้รับเอกสาร</p>
        </div>
      );
    case "sellerFooter":
      return (
        <p className="text-[8px] text-muted-foreground">
          บริษัทตัวอย่าง จำกัด · ที่อยู่ · โทรศัพท์ · อีเมล
        </p>
      );
  }
}

function LayoutBlock({
  block,
  canMove,
  config,
  isPending,
  onMove,
  onSelect,
  selected,
  template,
}: {
  block: QuotationLayoutBlock;
  canMove: (
    id: QuotationLayoutBlockId,
    direction: LayoutMoveDirection,
  ) => boolean;
  config: QuotationLayoutConfig;
  isPending: boolean;
  onMove: (id: QuotationLayoutBlockId, direction: LayoutMoveDirection) => void;
  onSelect: (id: QuotationLayoutBlockId) => void;
  selected: boolean;
  template: QuotationTemplate;
}) {
  const palette = quotationThemePalette(config.themeColor);
  return (
    <div
      className={cn(
        "relative min-h-20 min-w-0 cursor-pointer rounded-md border bg-white p-3 shadow-sm transition",
        selected && "ring-2 ring-primary/20",
      )}
      data-layout-block={block.id}
      onClick={() => onSelect(block.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(block.id);
        }
      }}
      role="button"
      style={{
        borderColor: selected ? palette.primary : palette.border,
        gridColumn: `${block.column} / span ${block.span}`,
        gridRow: `${quotationLayoutBlockRow(config, block.id)} / span ${quotationLayoutBlockRowSpan(template, block.id)}`,
      }}
      tabIndex={0}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-slate-700">
          {BLOCK_LABELS[block.id]}
        </p>
      </div>
      <BlockPreview
        id={block.id}
        template={template}
        themeColor={config.themeColor}
      />
      {selected ? (
        <div className="mt-3 border-t pt-2" data-layout-position-controls>
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">
            ย้ายตำแหน่ง
          </p>
          <div className="grid grid-cols-2 gap-1">
            <Button
              aria-label={`ย้าย ${BLOCK_LABELS[block.id]} ขึ้น`}
              disabled={isPending || !canMove(block.id, "up")}
              onClick={(event) => {
                event.stopPropagation();
                onMove(block.id, "up");
              }}
              size="xs"
              type="button"
              variant="secondary"
            >
              <ArrowUp aria-hidden="true" />
              ขึ้น
            </Button>
            <Button
              aria-label={`ย้าย ${BLOCK_LABELS[block.id]} ลง`}
              disabled={isPending || !canMove(block.id, "down")}
              onClick={(event) => {
                event.stopPropagation();
                onMove(block.id, "down");
              }}
              size="xs"
              type="button"
              variant="secondary"
            >
              <ArrowDown aria-hidden="true" />
              ลง
            </Button>
            <Button
              aria-label={`ย้าย ${BLOCK_LABELS[block.id]} ซ้าย`}
              disabled={isPending || !canMove(block.id, "left")}
              onClick={(event) => {
                event.stopPropagation();
                onMove(block.id, "left");
              }}
              size="xs"
              type="button"
              variant="secondary"
            >
              <ArrowLeft aria-hidden="true" />
              ซ้าย
            </Button>
            <Button
              aria-label={`ย้าย ${BLOCK_LABELS[block.id]} ขวา`}
              disabled={isPending || !canMove(block.id, "right")}
              onClick={(event) => {
                event.stopPropagation();
                onMove(block.id, "right");
              }}
              size="xs"
              type="button"
              variant="secondary"
            >
              <ArrowRight aria-hidden="true" />
              ขวา
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
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
  const [selectedId, setSelectedId] = useState<QuotationLayoutBlockId>(
    initial.config.blocks[0]?.id ?? "seller",
  );
  const [undoStack, setUndoStack] = useState<QuotationLayoutConfig[]>([]);
  const [redoStack, setRedoStack] = useState<QuotationLayoutConfig[]>([]);
  const [isPending, startTransition] = useTransition();
  const changed = JSON.stringify(draft) !== JSON.stringify(initial.config);
  const selected =
    draft.blocks.find((block) => block.id === selectedId) ?? draft.blocks[0];
  const visibleRevisions = revisions.slice(0, 2);
  const movableZones = quotationLayoutZonesInDocumentOrder(draft);
  const palette = quotationThemePalette(draft.themeColor);

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

  function updateThemeColor(value: string) {
    const next = clone(draft);
    next.themeColor = value.toUpperCase();
    update(next);
  }

  function settlementColumnLayout(
    id: QuotationLayoutBlockId,
    direction: LayoutMoveDirection,
  ): QuotationLayoutConfig | undefined {
    if (
      (direction !== "left" && direction !== "right") ||
      !["paymentMethods", "publicNotes", "summary"].includes(id)
    )
      return undefined;
    const next = clone(draft);
    const summary = next.blocks.find((block) => block.id === "summary");
    const paymentMethods = next.blocks.find(
      (block) => block.id === "paymentMethods",
    );
    const publicNotes = next.blocks.find((block) => block.id === "publicNotes");
    if (
      !summary ||
      !paymentMethods ||
      !publicNotes ||
      summary.zone !== "settlement" ||
      paymentMethods.zone !== "settlement" ||
      publicNotes.zone !== "settlement"
    )
      return undefined;

    const summaryIsLeft = summary.column < paymentMethods.column;
    const movesSummary =
      id === "summary" &&
      ((direction === "left" && !summaryIsLeft) ||
        (direction === "right" && summaryIsLeft));
    const movesPaymentColumn =
      id !== "summary" &&
      ((direction === "right" && !summaryIsLeft) ||
        (direction === "left" && summaryIsLeft));
    if (!movesSummary && !movesPaymentColumn) return undefined;

    const settlementOrder = Math.min(summary.order, paymentMethods.order);
    summary.column = summaryIsLeft ? 13 - summary.span : 1;
    paymentMethods.column = summaryIsLeft ? 1 : 13 - paymentMethods.span;
    publicNotes.column = paymentMethods.column;
    summary.order = settlementOrder;
    paymentMethods.order = settlementOrder;
    publicNotes.order = settlementOrder + 10;
    return isQuotationLayoutConfig(next, template) ? next : undefined;
  }

  function swappedLayout(
    sourceId: QuotationLayoutBlockId,
    targetId: QuotationLayoutBlockId,
  ): QuotationLayoutConfig | undefined {
    const next = clone(draft);
    const source = next.blocks.find((block) => block.id === sourceId);
    const target = next.blocks.find((block) => block.id === targetId);
    if (!source || !target || source.zone !== target.zone) return undefined;

    if (
      quotationLayoutBlockRow(next, source.id) ===
      quotationLayoutBlockRow(next, target.id)
    ) {
      const sourceIsLeft = source.column < target.column;
      source.column = sourceIsLeft ? 13 - source.span : 1;
      target.column = sourceIsLeft ? 1 : 13 - target.span;
      const rowOrder = Math.min(source.order, target.order);
      source.order = rowOrder;
      target.order = rowOrder;
    } else {
      [source.order, target.order] = [target.order, source.order];
    }

    return isQuotationLayoutConfig(next, template) ? next : undefined;
  }

  function swapPositions(
    sourceId: QuotationLayoutBlockId,
    targetId: QuotationLayoutBlockId,
  ) {
    const next = swappedLayout(sourceId, targetId);
    if (!next) {
      toast.error("ตำแหน่งปลายทางมีบล็อกอื่นอยู่ จึงสลับไม่ได้");
      return;
    }
    update(next);
  }

  function directionalTarget(
    id: QuotationLayoutBlockId,
    direction: LayoutMoveDirection,
  ) {
    const source = draft.blocks.find((block) => block.id === id);
    if (!source) return undefined;
    const sourceRow = quotationLayoutBlockRow(draft, source.id);
    const candidates = draft.blocks.filter(
      (block) => block.zone === source.zone && block.id !== source.id,
    );

    if (direction === "left")
      return candidates
        .filter(
          (block) =>
            quotationLayoutBlockRow(draft, block.id) === sourceRow &&
            block.column < source.column,
        )
        .sort((left, right) => right.column - left.column)[0];
    if (direction === "right")
      return candidates
        .filter(
          (block) =>
            quotationLayoutBlockRow(draft, block.id) === sourceRow &&
            block.column > source.column,
        )
        .sort((left, right) => left.column - right.column)[0];

    const rows = candidates.map((block) =>
      quotationLayoutBlockRow(draft, block.id),
    );
    const targetRow =
      direction === "up"
        ? Math.max(...rows.filter((row) => row < sourceRow))
        : Math.min(...rows.filter((row) => row > sourceRow));
    if (!Number.isFinite(targetRow)) return undefined;
    return candidates
      .filter((block) => quotationLayoutBlockRow(draft, block.id) === targetRow)
      .sort(
        (left, right) =>
          Math.abs(left.column - source.column) -
          Math.abs(right.column - source.column),
      )[0];
  }

  function canMoveFromLayout(
    id: QuotationLayoutBlockId,
    direction: LayoutMoveDirection,
  ): boolean {
    if (settlementColumnLayout(id, direction)) return true;
    const target = directionalTarget(id, direction);
    return Boolean(target && swappedLayout(id, target.id));
  }

  function moveFromLayout(
    id: QuotationLayoutBlockId,
    direction: LayoutMoveDirection,
  ) {
    const settlementNext = settlementColumnLayout(id, direction);
    if (settlementNext) {
      update(settlementNext);
      return;
    }
    const target = directionalTarget(id, direction);
    if (!target) {
      toast.error(
        `ไม่มีบล็อก${direction === "up" ? "ด้านบน" : direction === "down" ? "ด้านล่าง" : direction === "left" ? "ด้านซ้าย" : "ด้านขวา"}ให้สลับ`,
      );
      return;
    }
    swapPositions(id, target.id);
  }

  function moveDocumentSection(
    zone: QuotationLayoutBlock["zone"],
    direction: "up" | "down",
  ) {
    if (zone === "footer") return;
    const currentIndex = movableZones.indexOf(zone);
    const targetIndex = currentIndex + (direction === "up" ? -1 : 1);
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= movableZones.length
    )
      return;
    const nextZones = [...movableZones];
    [nextZones[currentIndex], nextZones[targetIndex]] = [
      nextZones[targetIndex],
      nextZones[currentIndex],
    ];
    const next = clone(draft);
    nextZones.forEach((section, sectionIndex) => {
      blocksInZone(next, section).forEach((block, blockIndex) => {
        const target = next.blocks.find((item) => item.id === block.id);
        if (target) target.order = (sectionIndex + 1) * 100 + blockIndex * 10;
      });
    });
    update(next);
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
    <div
      className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]"
      data-quotation-layout-editor
    >
      <Card className="overflow-hidden">
        <CardHeader className="gap-3 border-b bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                จัดหน้า {QUOTATION_TEMPLATE_LABELS[template]} · เวอร์ชัน{" "}
                {initial.revisionNumber}
              </CardTitle>
              <p className="mt-1 text-sm font-normal text-muted-foreground">
                เลือกสีหลักหนึ่งสี แล้วเลือกบล็อกเพื่อใช้ปุ่มขึ้น ลง ซ้าย
                หรือขวา · ระบบจะปิดปุ่มที่ไม่สามารถย้ายได้
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-2 text-sm font-medium"
                htmlFor={`quotation-theme-${template}`}
              >
                <span>สีหลัก</span>
                <input
                  aria-label={`สีหลักของเทมเพลต ${QUOTATION_TEMPLATE_LABELS[template]}`}
                  className="h-9 w-12 cursor-pointer rounded border bg-background p-1"
                  id={`quotation-theme-${template}`}
                  onInput={(event) =>
                    updateThemeColor(event.currentTarget.value)
                  }
                  type="color"
                  value={draft.themeColor}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {draft.themeColor}
                </span>
              </label>
              <div className="flex gap-1">
                <Button
                  aria-label="ย้อนกลับการแก้ไขล่าสุด"
                  disabled={!undoStack.length || isPending}
                  onClick={undo}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <Undo2 aria-hidden="true" />
                </Button>
                <Button
                  aria-label="ทำซ้ำการแก้ไขล่าสุด"
                  disabled={!redoStack.length || isPending}
                  onClick={redo}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <Redo2 aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="bg-muted/20 p-4 sm:p-6">
          <div
            className={cn(
              "mx-auto grid w-full max-w-[210mm] gap-5 rounded-sm p-5 shadow-md ring-1 ring-border sm:p-7",
              TEMPLATE_CANVAS[template].frame,
            )}
            data-layout-a4-canvas
            data-layout-template={template}
          >
            <div
              className="-mx-5 -mt-5 h-2 sm:-mx-7 sm:-mt-7"
              aria-hidden="true"
              style={{ backgroundColor: palette.primary }}
            />
            <div className="-mt-3 flex items-center justify-between border-b pb-3">
              <p className="text-sm font-semibold">
                ผังเอกสาร {TEMPLATE_CANVAS[template].name}
              </p>
              <p className="text-xs text-muted-foreground">
                ขนาดและรูปทรงเฉพาะเทมเพลต
              </p>
            </div>
            <section
              className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,0.7fr)] items-start gap-4 rounded-md border bg-white p-3"
              data-layout-locked-masthead
              style={{ borderColor: palette.border }}
            >
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <div
                  className="grid size-9 place-items-center rounded border text-[8px] font-semibold"
                  style={{ borderColor: palette.border, color: palette.primary }}
                >
                  LOGO
                </div>
                <span>ล็อกอยู่บนสุดเสมอ</span>
              </div>
              <div className="text-right">
                <p className="text-[8px]">(ต้นฉบับ)</p>
                <p
                  className="text-base font-semibold tracking-wide"
                  style={{ color: palette.primary }}
                >
                  {template === "current" ? "ใบเสนอราคา" : "QUOTATION"}
                </p>
                {template !== "current" ? (
                  <p className="text-[9px]" style={{ color: palette.muted }}>
                    ใบเสนอราคา
                  </p>
                ) : null}
                {template === "corporate" ? (
                  <p
                    className="mt-1 inline-block rounded px-1.5 py-0.5 text-[8px]"
                    style={{
                      backgroundColor: palette.primary,
                      color: palette.contrast,
                    }}
                  >
                    QO-000001
                  </p>
                ) : null}
              </div>
            </section>
            {[...movableZones, "footer" as const].map((zone, zoneIndex) => {
              const blocks = blocksInZone(draft, zone);
              if (!blocks.length) return null;
              return (
                <section
                  className="grid gap-2"
                  data-layout-zone={zone}
                  key={zone}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-px flex-1"
                      style={{ backgroundColor: palette.border }}
                    />
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {ZONE_LABELS[zone]}
                    </p>
                    {zone !== "footer" ? (
                      <div className="flex gap-1" data-layout-section-controls>
                        <Button
                          aria-label={`ย้าย ${ZONE_LABELS[zone]} ขึ้น`}
                          disabled={isPending || zoneIndex === 0}
                          onClick={() => moveDocumentSection(zone, "up")}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          aria-label={`ย้าย ${ZONE_LABELS[zone]} ลง`}
                          disabled={
                            isPending || zoneIndex === movableZones.length - 1
                          }
                          onClick={() => moveDocumentSection(zone, "down")}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <ArrowDown aria-hidden="true" />
                        </Button>
                      </div>
                    ) : null}
                    <span
                      className="h-px flex-1"
                      style={{ backgroundColor: palette.border }}
                    />
                  </div>
                  <div className="grid grid-cols-12 gap-2.5">
                    {blocks.map((block) => (
                      <LayoutBlock
                        block={block}
                        canMove={canMoveFromLayout}
                        config={draft}
                        isPending={isPending}
                        key={block.id}
                        onMove={moveFromLayout}
                        onSelect={setSelectedId}
                        selected={selected?.id === block.id}
                        template={template}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <aside className="grid content-start gap-4 xl:sticky xl:top-4 xl:self-start">
        {selected ? (
          <Card>
            <CardHeader className="pb-3">
              <p className="text-xs font-medium text-muted-foreground">
                กำลังเลือก
              </p>
              <CardTitle className="text-base">
                {BLOCK_LABELS[selected.id]}
              </CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                {ZONE_LABELS[selected.zone]} · ขนาดล็อกตามเทมเพลต
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {selected.zone === "settlement" &&
                ["paymentMethods", "publicNotes", "summary"].includes(
                  selected.id,
                )
                  ? "ย้ายซ้ายหรือขวาเพื่อสลับคอลัมน์สรุปยอดกับช่องทางชำระเงินและหมายเหตุพร้อมกัน"
                  : "ใช้ปุ่มย้ายตำแหน่งบนบล็อกที่เลือกในหน้ากระดาษได้โดยตรง"}
              </p>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">เวอร์ชัน</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {visibleRevisions.map((revision, index) => (
              <div
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                key={revision.revisionNumber}
              >
                <span>
                  <History aria-hidden="true" className="mr-1 inline size-3" />
                  {index === 0 ? "ปัจจุบัน" : "ก่อนหน้า"}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    ผู้ดูแล · {revisionTimestamp(revision.createdAt)}
                  </span>
                </span>
                {revision.revisionNumber === initial.revisionNumber ? (
                  <span className="text-xs text-muted-foreground">
                    กำลังใช้
                  </span>
                ) : (
                  <Button
                    disabled={isPending}
                    onClick={() => publish(revision.config)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <RotateCcw aria-hidden="true" />
                    คืนค่า
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={isPending || !changed}
            onClick={() => {
              setDraft(clone(initial.config));
              setUndoStack([]);
              setRedoStack([]);
            }}
            type="button"
            variant="outline"
          >
            ยกเลิกการแก้ไข
          </Button>
          <Button
            disabled={isPending || !changed}
            onClick={() => publish(draft)}
            type="button"
          >
            {isPending ? "กำลังเผยแพร่…" : "เผยแพร่เลเอาท์"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
