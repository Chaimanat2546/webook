import Link from "next/link";

import { QuotationEditor } from "../../../../components/admin/quotations/quotation-editor";
import { Button } from "../../../../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../../../components/ui/empty";
import { getQuotationPublicOrigin } from "../../../../lib/env";
import { canUseQuotation, requireAdmin } from "../../../../server/auth/admin";
import { companyProfileToCertification, companyProfileToDocumentDisplay, companyProfileToSeller, getQuotationCompanyProfile, listCompanyPaymentMethods, listQuotationBanks, listQuotationItemNames } from "../../../../server/repositories/quotations";
import { emptyQuotationPayload } from "../../../../server/services/quotations";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const { adminUser, supabase, user } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return <Empty><EmptyHeader><EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา</EmptyTitle></EmptyHeader></Empty>;

  const [profile, banks, paymentMethods, itemNames] = await Promise.all([
    getQuotationCompanyProfile(supabase, user.id),
    listQuotationBanks(supabase),
    listCompanyPaymentMethods(supabase, user.id),
    listQuotationItemNames(supabase),
  ]);
  if (!profile) return <Empty><EmptyHeader><EmptyTitle>ตั้งค่าข้อมูลผู้ขายหลักก่อนสร้างใบเสนอราคา</EmptyTitle><EmptyDescription>ข้อมูลผู้ขายจะถูกคัดลอกลงในใบเสนอราคา</EmptyDescription></EmptyHeader><Button asChild><Link href="/admin/quotations/settings/company">ตั้งค่าข้อมูลผู้ขายหลัก</Link></Button></Empty>;

  const initialPayload = emptyQuotationPayload(
    companyProfileToSeller(profile),
    new Date(),
    companyProfileToCertification(profile),
    companyProfileToDocumentDisplay(profile),
  );
  initialPayload.paymentMethods = paymentMethods.filter((method) => method.isDefault).map((method, index) => {
    const snapshot = { ...method };
    Reflect.deleteProperty(snapshot, "isDefault");
    return { ...snapshot, id: crypto.randomUUID(), position: index + 1 };
  });
  const publicOrigin = getQuotationPublicOrigin();
  return <QuotationEditor banks={banks} documentNumber={null} initialPayload={initialPayload} itemNames={itemNames} publicOrigin={publicOrigin} publicToken={null} />;
}
