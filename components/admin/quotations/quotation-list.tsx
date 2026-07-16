"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteQuotationAction } from "../../../app/admin/quotations/actions";
import type { QuotationListItem } from "../../../server/repositories/quotations";
import { Button } from "../../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";

const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2 });
const moneyInBaht = (value: string) => `${money.format(Number(value))} บาท`;

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH");
}

function quotationHref(id: string): string {
  return `/admin/quotations/${encodeURIComponent(id)}`;
}

function QuotationActions({ quotation, onDelete }: { quotation: QuotationListItem; onDelete: () => void }) {
  const href = quotationHref(quotation.id);
  return <div className="flex flex-wrap gap-2">
    <Button asChild size="sm" variant="outline"><Link href={href}>แก้ไข</Link></Button>
    <Button asChild size="sm" variant="outline"><Link href={`${href}?print=1`}>พิมพ์</Link></Button>
    <Button onClick={onDelete} size="sm" type="button" variant="destructive">ลบ</Button>
  </div>;
}

export function QuotationList({ quotations }: { quotations: QuotationListItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<QuotationListItem | null>(null);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  function deleteSelected() {
    if (!selected) return;
    setFormError("");
    startTransition(async () => {
      const result = await deleteQuotationAction(selected.id);
      if (!result.ok) return setFormError(result.formError);
      setSelected(null);
      router.refresh();
    });
  }

  return <>
    <div className="space-y-3 md:hidden">
      {quotations.map((quotation) => <Card key={quotation.id}>
        <CardHeader><CardTitle>{quotation.documentNumber}</CardTitle><p className="text-sm text-muted-foreground">{quotation.customerName || "-"}</p></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div><p className="text-muted-foreground">วันที่ออก</p><p>{formatDate(quotation.issueDate)}</p></div>
          <div><p className="text-muted-foreground">ใช้ได้ถึง</p><p>{formatDate(quotation.validUntil)}</p></div>
          <div className="col-span-2"><p className="text-muted-foreground">ยอดรวม</p><p className="font-medium">{moneyInBaht(quotation.grandTotal)}</p></div>
        </CardContent>
        <CardFooter><QuotationActions quotation={quotation} onDelete={() => setSelected(quotation)} /></CardFooter>
      </Card>)}
    </div>
    <Card className="hidden overflow-hidden p-0 md:block">
      <Table><TableHeader><TableRow>
        <TableHead>เลขที่เอกสาร</TableHead><TableHead>ลูกค้า</TableHead><TableHead>วันที่ออก</TableHead><TableHead>ใช้ได้ถึง</TableHead><TableHead>ยอดรวม</TableHead><TableHead>อัปเดต</TableHead><TableHead><span className="sr-only">การทำงาน</span></TableHead>
      </TableRow></TableHeader><TableBody>
        {quotations.map((quotation) => <TableRow key={quotation.id}>
          <TableCell className="font-medium">{quotation.documentNumber}</TableCell><TableCell>{quotation.customerName || "-"}</TableCell><TableCell>{formatDate(quotation.issueDate)}</TableCell><TableCell>{formatDate(quotation.validUntil)}</TableCell><TableCell>{moneyInBaht(quotation.grandTotal)}</TableCell><TableCell>{new Date(quotation.updatedAt).toLocaleString("th-TH")}</TableCell><TableCell><QuotationActions quotation={quotation} onDelete={() => setSelected(quotation)} /></TableCell>
        </TableRow>)}
      </TableBody></Table>
    </Card>
    <Dialog onOpenChange={(open) => !open && setSelected(null)} open={selected !== null}>
      <DialogContent><DialogHeader><DialogTitle>ลบใบเสนอราคา</DialogTitle><DialogDescription>ต้องการลบ {selected?.documentNumber} ของ {selected?.customerName || "-"} ใช่หรือไม่</DialogDescription></DialogHeader>
        {formError ? <p className="text-sm text-destructive" role="alert">{formError}</p> : null}
        <DialogFooter><Button disabled={isPending} onClick={() => setSelected(null)} type="button" variant="outline">ยกเลิก</Button><Button disabled={isPending} onClick={deleteSelected} type="button" variant="destructive">ลบ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
