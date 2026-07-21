"use client";

import {
  EllipsisVerticalIcon,
  PencilLineIcon,
  PrinterIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteQuotationAction } from "../../../app/admin/quotations/actions";
import { formatBaht } from "../../../lib/quotation-money";
import type { QuotationListItem } from "../../../server/repositories/quotations";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH");
}

function quotationHref(id: string): string {
  return `/admin/quotations/${encodeURIComponent(id)}`;
}

function QuotationActionsMenu({
  quotation,
  onDelete,
}: {
  quotation: QuotationListItem;
  onDelete: () => void;
}) {
  const href = quotationHref(quotation.id);
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="เปิดเมนูจัดการใบเสนอราคา"
            size="icon"
            type="button"
            variant="outline"
          >
            <EllipsisVerticalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={href}>
                <PencilLineIcon aria-hidden />
                แก้ไข
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${href}?print=1`}>
                <PrinterIcon aria-hidden />
                พิมพ์
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} variant="destructive">
              <Trash2Icon aria-hidden />
              ลบ
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function QuotationList({ quotations }: { quotations: QuotationListItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<QuotationListItem | null>(null);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  function openQuotation(quotation: QuotationListItem) {
    router.push(quotationHref(quotation.id));
  }

  function deleteSelected() {
    if (!selected) return;
    setFormError("");
    startTransition(async () => {
      const result = await deleteQuotationAction(selected.id);
      if (!result.ok) {
        setFormError(result.formError);
        toast.error(result.formError);
        return;
      }
      toast.success(`ลบ ${selected.documentNumber} แล้ว`);
      setSelected(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {quotations.map((quotation) => (
          <Card
            className="cursor-pointer"
            key={quotation.id}
            onClick={() => openQuotation(quotation)}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">
                  <Link
                    aria-label={`เปิด ${quotation.documentNumber}`}
                    className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={quotationHref(quotation.id)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {quotation.documentNumber}
                  </Link>
                </CardTitle>
                <p className="truncate text-sm text-muted-foreground">
                  {quotation.customerName || "-"}
                </p>
              </div>
              <QuotationActionsMenu
                quotation={quotation}
                onDelete={() => setSelected(quotation)}
              />
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">วันที่ออก</dt>
                  <dd>{formatDate(quotation.issueDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ใช้ได้ถึง</dt>
                  <dd>{formatDate(quotation.validUntil)}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-muted-foreground">ยอดสุทธิ</dt>
                  <dd className="font-medium tabular-nums">
                    {formatBaht(quotation.grandTotal)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[24%]">เลขที่เอกสาร</TableHead>
              <TableHead className="w-[28%]">ลูกค้า</TableHead>
              <TableHead className="w-[14%]">วันที่ออก</TableHead>
              <TableHead className="w-[14%]">ใช้ได้ถึง</TableHead>
              <TableHead className="w-[14%] text-right">ยอดสุทธิ</TableHead>
              <TableHead className="w-[6%]">
                <span className="sr-only">การจัดการ</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.map((quotation) => (
              <TableRow
                className="cursor-pointer"
                key={quotation.id}
                onClick={() => openQuotation(quotation)}
              >
                <TableCell className="truncate font-medium">
                  <Link
                    aria-label={`เปิด ${quotation.documentNumber}`}
                    className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={quotationHref(quotation.id)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {quotation.documentNumber}
                  </Link>
                </TableCell>
                <TableCell className="truncate">{quotation.customerName || "-"}</TableCell>
                <TableCell>{formatDate(quotation.issueDate)}</TableCell>
                <TableCell>{formatDate(quotation.validUntil)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatBaht(quotation.grandTotal)}
                </TableCell>
                <TableCell className="text-right">
                  <QuotationActionsMenu
                    quotation={quotation}
                    onDelete={() => setSelected(quotation)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog onOpenChange={(open) => !open && setSelected(null)} open={selected !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบใบเสนอราคา</DialogTitle>
            <DialogDescription>
              ต้องการลบ {selected?.documentNumber} ของ {selected?.customerName || "-"} ใช่หรือไม่
            </DialogDescription>
          </DialogHeader>
          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => setSelected(null)}
              type="button"
              variant="outline"
            >
              ยกเลิก
            </Button>
            <Button
              disabled={isPending}
              onClick={deleteSelected}
              type="button"
              variant="destructive"
            >
              {isPending ? "กำลังลบ…" : "ลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
