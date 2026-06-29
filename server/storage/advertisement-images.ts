import { buildAdvertisementImageUrl } from "../../lib/advertisement-image-url.ts";

interface WorkerConfig {
  fetchImpl?: typeof fetch;
  imageName: string;
  workerSecret: string;
  workerUrl: string;
}

async function workerErrorMessage(action: string, response: Response): Promise<string> {
  const body = (await response.text()).trim().slice(0, 200);
  return `Failed to ${action} advertisement image (${response.status})${body ? `: ${body}` : ""}`;
}

export async function uploadAdvertisementImageObject({
  body,
  contentType,
  fetchImpl = fetch,
  imageName,
  workerSecret,
  workerUrl,
}: WorkerConfig & {
  body: BodyInit;
  contentType: string;
}) {
  const response = await fetchImpl(buildAdvertisementImageUrl(imageName, workerUrl), {
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

export async function deleteAdvertisementImageObject({
  fetchImpl = fetch,
  imageName,
  workerSecret,
  workerUrl,
}: WorkerConfig) {
  const response = await fetchImpl(buildAdvertisementImageUrl(imageName, workerUrl), {
    headers: {
      authorization: `Bearer ${workerSecret}`,
    },
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await workerErrorMessage("delete", response));
  }
}
