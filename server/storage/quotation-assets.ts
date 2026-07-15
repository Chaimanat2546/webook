import { buildQuotationAssetUrl } from "../../lib/quotation-assets.ts";

interface Config {
  fetchImpl?: typeof fetch;
  objectKey: string;
  workerSecret: string;
  workerUrl: string;
}

async function workerError(action: string, response: Response): Promise<Error> {
  const body = (await response.text()).trim().slice(0, 200);
  return new Error(`Failed to ${action} quotation asset (${response.status})${body ? `: ${body}` : ""}`);
}

export async function uploadQuotationAssetObject({ body, fetchImpl = fetch, objectKey, workerSecret, workerUrl }: Config & { body: BodyInit }) {
  const response = await fetchImpl(buildQuotationAssetUrl(objectKey, workerUrl), {
    body, headers: { authorization: `Bearer ${workerSecret}`, "content-type": "image/webp" }, method: "PUT",
  });
  if (!response.ok) throw await workerError("upload", response);
}

export async function deleteQuotationAssetObject({ fetchImpl = fetch, objectKey, workerSecret, workerUrl }: Config) {
  const response = await fetchImpl(buildQuotationAssetUrl(objectKey, workerUrl), {
    headers: { authorization: `Bearer ${workerSecret}` }, method: "DELETE",
  });
  if (!response.ok) throw await workerError("delete", response);
}
