import Link from "next/link";

import { QuotationEditor } from "../../../../components/admin/quotations/quotation-editor";
import { Button } from "../../../../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../../../components/ui/empty";
import { canUseQuotation, requireAdmin } from "../../../../server/auth/admin";
import { companyProfileToSeller, getQuotationCompanyProfile } from "../../../../server/repositories/quotations";
import { emptyQuotationPayload } from "../../../../server/services/quotations";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return <Empty><EmptyHeader><EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา</EmptyTitle></EmptyHeader></Empty>;

  const profile = await getQuotationCompanyProfile(supabase);
  if (!profile) return <Empty><EmptyHeader><EmptyTitle>ตั้งค่าข้อมูลผู้ขายหลักก่อนสร้างใบเสนอราคา</EmptyTitle><EmptyDescription>ข้อมูลผู้ขายจะถูกคัดลอกลงในใบเสนอราคา</EmptyDescription></EmptyHeader><Button asChild><Link href="/admin/quotations/settings/company">ตั้งค่าข้อมูลผู้ขายหลัก</Link></Button></Empty>;

  return <QuotationEditor documentNumber={null} initialPayload={emptyQuotationPayload(companyProfileToSeller(profile), new Date())} publicToken={null} />;
}
