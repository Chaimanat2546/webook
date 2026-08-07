import type { ComponentType } from "react";
import type { QuotationCalculation } from "../../../lib/quotation-calculator";
import { buildQuotationDocumentViewModel } from "../../../lib/quotation-document-view";
import type { QuotationTemplate } from "../../../lib/quotation-template";
import type { QuotationPayload } from "../../../lib/quotation-types";
import { CorporateQuotationDocument } from "./templates/quotation-document-corporate";
import type { QuotationDocumentRendererProps } from "./templates/quotation-document-contract";
import { CurrentQuotationDocument } from "./templates/quotation-document-current";
import { HospitalityQuotationDocument } from "./templates/quotation-document-hospitality";

const renderers: Record<
  QuotationTemplate,
  ComponentType<QuotationDocumentRendererProps>
> = {
  corporate: CorporateQuotationDocument,
  current: CurrentQuotationDocument,
  hospitality: HospitalityQuotationDocument,
};

export function QuotationDocument({
  calculation,
  documentNumber,
  payload,
  publicQrDataUrl,
}: {
  calculation: QuotationCalculation;
  documentNumber: string | null;
  payload: QuotationPayload;
  publicQrDataUrl?: string | null;
}) {
  const model = buildQuotationDocumentViewModel({
    calculation,
    documentNumber,
    payload,
    publicQrDataUrl,
  });
  const Renderer = renderers[payload.template];

  return <Renderer model={model} />;
}
