import { notFound } from "next/navigation";

import { QuotationEditor } from "../../../../components/admin/quotations/quotation-editor";
import { getQuotationPublicOrigin } from "../../../../lib/env";
import { hydratePaymentMethodBanks } from "../../../../lib/quotation-payment-methods";
import { Empty, EmptyHeader, EmptyTitle } from "../../../../components/ui/empty";
import { canUseQuotation, requireAdmin } from "../../../../server/auth/admin";
import { companyProfileToTemplate, getQuotationById, getQuotationCompanyProfile, listQuotationBanks, listQuotationItemNames } from "../../../../server/repositories/quotations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function EditQuotationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const [{ id }, { print }] = await Promise.all([params, searchParams]);
  const { adminUser, supabase, user } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return <Empty><EmptyHeader><EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา</EmptyTitle></EmptyHeader></Empty>;
  if (!UUID.test(id)) notFound();
  const [quotation, profile, banks, itemNames] = await Promise.all([getQuotationById(supabase, id), getQuotationCompanyProfile(supabase, user.id), listQuotationBanks(supabase), listQuotationItemNames(supabase)]);
  if (!quotation) notFound();
  if (!profile) return <Empty><EmptyHeader><EmptyTitle>ตั้งค่าข้อมูลผู้ขายหลักก่อนแก้ไขใบเสนอราคา</EmptyTitle></EmptyHeader></Empty>;
  const initialPayload = { ...quotation.payload, paymentMethods: hydratePaymentMethodBanks(quotation.payload.paymentMethods, banks) };
  const publicOrigin = getQuotationPublicOrigin();
  return <QuotationEditor banks={banks} documentNumber={quotation.documentNumber} initialPayload={initialPayload} initialTemplateDefault={companyProfileToTemplate(profile)} itemNames={itemNames} printOnLoad={print === "1"} publicOrigin={publicOrigin} publicToken={quotation.publicToken} />;
}
