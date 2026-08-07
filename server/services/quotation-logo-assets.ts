import "server-only";

import {
  QUOTATION_ASSET_MAX_BYTES,
  buildQuotationAssetObjectKey,
  buildQuotationAssetUrl,
} from "../../lib/quotation-assets";
import { getQuotationAssetRuntimeEnv } from "../storage/quotation-asset-env";
import { uploadQuotationAssetObject } from "../storage/quotation-assets";
import { validateQuotationUploadedImage } from "./quotation-image-validation";

/** Uploads a logo that belongs only to the current quotation snapshot. */
export async function uploadQuotationLogoImage(file: File): Promise<string> {
  if (file.size === 0) throw new Error("ไฟล์โลโก้ว่างเปล่า");
  if (file.size > QUOTATION_ASSET_MAX_BYTES) {
    throw new Error("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 10 MB");
  }

  const body = await validateQuotationUploadedImage(file, "webp");
  const env = await getQuotationAssetRuntimeEnv();
  const objectKey = buildQuotationAssetObjectKey();
  await uploadQuotationAssetObject({
    body,
    contentType: "image/webp",
    objectKey,
    ...env,
  });
  return buildQuotationAssetUrl(objectKey, env.workerUrl);
}
