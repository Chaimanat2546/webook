import { notFound } from "next/navigation";

import { QuotationEditor } from "../../../../components/admin/quotations/quotation-editor";
import { Empty, EmptyHeader, EmptyTitle } from "../../../../components/ui/empty";
import { canUseQuotation, requireAdmin } from "../../../../server/auth/admin";
import { getQuotationById } from "../../../../server/repositories/quotations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export default async function EditQuotationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const [{ id }, { print }] = await Promise.all([params, searchParams]);
  const { adminUser, supabase } = await requireAdmin();
  if (!canUseQuotation(adminUser)) return <Empty><EmptyHeader><EmptyTitle>ไม่มีสิทธิ์เข้าถึงหมวดใบเสนอราคา</EmptyTitle></EmptyHeader></Empty>;
  if (!UUID.test(id)) notFound();
  const quotation = await getQuotationById(supabase, id);
  if (!quotation) notFound();
  return <QuotationEditor documentNumber={quotation.documentNumber} initialPayload={quotation.payload} printOnLoad={print === "1"} publicToken={quotation.publicToken} />;
}
