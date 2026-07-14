import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../components/ui/empty";
import { canUseQuotation, requireAdmin } from "../../../server/auth/admin";

export default async function QuotationsPage() {
  const { adminUser } = await requireAdmin();

  if (!canUseQuotation(adminUser)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา</EmptyTitle>
          <EmptyDescription>บัญชีนี้ยังไม่ได้เปิด allow_quotation</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">ใบเสนอราคา</h1>
      <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลใบเสนอราคา</p>
    </div>
  );
}
