import "server-only";

import {
  QUOTATION_SNAPSHOT_IMAGE_MAX_BYTES,
  buildQuotationCertificationAssetObjectKey,
  buildQuotationCertificationAssetUrl,
} from "../../lib/quotation-assets";
import { validateQuotationUploadedImage } from "./quotation-image-validation";
import { getQuotationAssetRuntimeEnv } from "../storage/quotation-asset-env";
import { uploadQuotationAssetObject } from "../storage/quotation-assets";

export async function uploadQuotationCertificationImage(file: File): Promise<string> {
  if (file.size === 0) throw new Error("ไฟล์รูปว่างเปล่า");
  if (file.size > QUOTATION_SNAPSHOT_IMAGE_MAX_BYTES) throw new Error("ไฟล์รูปต้องมีขนาดไม่เกิน 2 MB");

  // The PNG byte signature and dimensions are the authoritative server-side boundary.
  const body = await validateQuotationUploadedImage(file, "png");
  const env = await getQuotationAssetRuntimeEnv();
  const objectKey = buildQuotationCertificationAssetObjectKey();
  await uploadQuotationAssetObject({
    body,
    contentType: "image/png",
    objectKey,
    ...env,
  });
  return buildQuotationCertificationAssetUrl(objectKey, env.workerUrl);
}
