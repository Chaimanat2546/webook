import { buildHouseImageUrl } from "../../lib/house-image-url.ts";

interface WorkerConfig {
  fetchImpl?: typeof fetch;
  objectKey: string;
  workerSecret: string;
  workerUrl: string;
}

async function workerErrorMessage(action: string, response: Response): Promise<string> {
  const body = (await response.text()).trim().slice(0, 200);
  return `Failed to ${action} house image (${response.status})${body ? `: ${body}` : ""}`;
}

export async function uploadHouseImageObject({
  body,
  contentType,
  fetchImpl = fetch,
  objectKey,
  workerSecret,
  workerUrl,
}: WorkerConfig & {
  body: BodyInit;
  contentType: string;
}) {
  const response = await fetchImpl(buildHouseImageUrl(objectKey, workerUrl), {
    body,
    headers: {
      authorization: `Bearer ${workerSecret}`,
      "content-type": contentType,
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(await workerErrorMessage("upload", response));
  }
}

export async function deleteHouseImageObject({
  fetchImpl = fetch,
  objectKey,
  workerSecret,
  workerUrl,
}: WorkerConfig) {
  const response = await fetchImpl(buildHouseImageUrl(objectKey, workerUrl), {
    headers: {
      authorization: `Bearer ${workerSecret}`,
    },
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await workerErrorMessage("delete", response));
  }
}
