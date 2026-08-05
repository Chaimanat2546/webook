import { Font, pdf } from "@react-pdf/renderer";
import type { ComponentType } from "react";

import type { QuotationCalculation } from "../../../lib/quotation-calculator";
import {
  buildQuotationDocumentViewModel,
  type QuotationDocumentViewModel,
} from "../../../lib/quotation-document-view";
import { splitQuotationPdfWord } from "../../../lib/quotation-pdf";
import type { QuotationTemplate } from "../../../lib/quotation-template";
import type { QuotationPayload } from "../../../lib/quotation-types";

import type {
  QuotationPdfRendererProps,
  ResolvedImages,
} from "./templates/quotation-pdf-contract";
import { CorporateQuotationPdf } from "./templates/quotation-pdf-corporate";
import { CurrentQuotationPdf } from "./templates/quotation-pdf-current";
import { HospitalityQuotationPdf } from "./templates/quotation-pdf-hospitality";

Font.register({
  family: "Noto Sans Thai",
  fonts: [
    { fontWeight: 400, src: "/fonts/NotoSansThai-Regular-v2.ttf" },
    { fontWeight: 600, src: "/fonts/NotoSansThai-SemiBold-v2.ttf" },
  ],
});

Font.registerHyphenationCallback(splitQuotationPdfWord);

type ImageConverter = (source: string) => Promise<string>;

export function collectQuotationPdfImageSources(
  model: QuotationDocumentViewModel,
): string[] {
  const { approver, companyStampUrl, issuer } = model.certification;
  return [...new Set([
    model.payload.seller.logoUrl,
    ...model.paymentMethods.flatMap((method) => [
      method.customBankLogoUrl || method.bankLogoUrl,
      method.qrSource,
    ]),
    issuer.signatureUrl,
    approver.signatureUrl,
    companyStampUrl,
    model.showCertificationQr ? model.publicQrDataUrl : "",
  ].filter(Boolean))];
}

async function convertQuotationPdfImage(source: string): Promise<string> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Unable to load image (${response.status})`);
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode image"));
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Image is empty");
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function resolveQuotationPdfImages(
  sources: string[],
  convert: ImageConverter = convertQuotationPdfImage,
): Promise<ResolvedImages> {
  const entries = await Promise.all(sources.map(async (source) => {
    try {
      return [source, await convert(source)] as const;
    } catch {
      return null;
    }
  }));
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

const renderers: Record<
  QuotationTemplate,
  ComponentType<QuotationPdfRendererProps>
> = {
  corporate: CorporateQuotationPdf,
  current: CurrentQuotationPdf,
  hospitality: HospitalityQuotationPdf,
};

export async function downloadQuotationPdf({
  calculation,
  documentNumber,
  payload,
  publicQrDataUrl,
}: {
  calculation: QuotationCalculation;
  documentNumber: string;
  payload: QuotationPayload;
  publicQrDataUrl: string;
}): Promise<void> {
  const model = buildQuotationDocumentViewModel({ calculation, documentNumber, payload, publicQrDataUrl });
  const images = await resolveQuotationPdfImages(collectQuotationPdfImageSources(model));
  if (model.showCertificationQr && !images[model.publicQrDataUrl]) throw new Error("Public QR image is unavailable");
  const Renderer = renderers[model.payload.template];
  const blob = await pdf(<Renderer images={images} model={model} />).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentNumber}.pdf`;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
