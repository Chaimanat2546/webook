import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuotationDocument } from "../../../components/admin/quotations/quotation-document";
import { calculateQuotation } from "../../../lib/quotation-calculator";
import { getQuotationPublicOrigin } from "../../../lib/env";
import {
  buildQuotationPublicUrl,
  createQuotationPublicQrDataUrl,
} from "../../../lib/quotation-public-qr";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getPublicQuotationByToken } from "../../../server/repositories/quotations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "ใบเสนอราคา",
};

export default async function PublicQuotationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  const supabase = await createSupabaseServerClient();
  const quotation = await getPublicQuotationByToken(supabase, token);
  if (!quotation) notFound();
  const calculation = calculateQuotation(quotation.payload);
  let publicQrDataUrl = "";
  try {
    const origin = getQuotationPublicOrigin();
    const publicUrl = origin ? buildQuotationPublicUrl(origin, token) : "";
    publicQrDataUrl = publicUrl ? await createQuotationPublicQrDataUrl(publicUrl) : "";
  } catch {
    publicQrDataUrl = "";
  }

  return (
    <main
      className="min-h-screen overflow-x-auto overscroll-x-contain bg-muted p-0 sm:p-4 print:overflow-visible print:bg-white print:p-0"
      data-public-quotation-viewport
    >
      <QuotationDocument
        calculation={calculation}
        documentNumber={quotation.documentNumber}
        payload={quotation.payload}
        publicQrDataUrl={publicQrDataUrl}
      />
    </main>
  );
}
