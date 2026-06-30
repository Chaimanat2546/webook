import { createHash, createHmac } from "node:crypto";

import { buildHouseImageUrl } from "../../lib/house-image-url.ts";

interface WorkerConfig {
  fetchImpl?: typeof fetch;
  objectKey: string;
  workerSecret: string;
  workerUrl: string;
}

interface AwsS3Config {
  accessKeyId: string;
  bucket: string;
  region: string;
  secretAccessKey: string;
}

const EMPTY_BODY_SHA256 = createHash("sha256").update("").digest("hex");
const AWS_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

async function workerErrorMessage(action: string, response: Response): Promise<string> {
  const body = (await response.text()).trim().slice(0, 200);
  const label =
    {
      delete: "ลบ",
      upload: "อัปโหลด",
      "verify delete": "ตรวจสอบการลบ",
    }[action] ?? action;
  return `${label}รูปบ้านพักไม่สำเร็จ (status ${response.status})${body ? `: ${body}` : ""}`;
}

function responseSummary(label: string, response: Response): string {
  const contentType = response.headers.get("content-type");
  return `${label} ${response.status}${contentType ? ` ${contentType}` : ""}`;
}

function s3PublicUrl(region: string, bucket: string, key: string): string {
  return `https://s3.${region}.amazonaws.com/${bucket}/${encodeURI(key)}`;
}

function validateAwsS3ImageKey(value: string): string {
  const key = value.trim().replace(/\\/g, "/");
  const parts = key.split("/");

  if (
    !key ||
    key.startsWith("/") ||
    parts.some((part) => !part || part === "." || part === "..") ||
    !AWS_IMAGE_EXTENSIONS.some((extension) => key.toLowerCase().endsWith(extension))
  ) {
    throw new Error("Invalid AWS image key");
  }

  return key;
}

function keyFromS3ImageUrl({
  bucket,
  imageUrl,
  region,
}: {
  bucket: string;
  imageUrl?: string | null;
  region: string;
}): string | null {
  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl.trim());
    if (url.protocol !== "https:" || url.hostname !== `s3.${region}.amazonaws.com`) return null;

    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const prefix = `${bucket}/`;
    if (!path.startsWith(prefix)) return null;

    return validateAwsS3ImageKey(path.slice(prefix.length));
  } catch {
    return null;
  }
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function signedS3Headers({
  accessKeyId,
  method,
  region,
  secretAccessKey,
  url,
}: AwsS3Config & {
  method: "DELETE" | "HEAD";
  url: URL;
}): Record<string, string> {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = [
    `host:${url.host}`,
    `x-amz-content-sha256:${EMPTY_BODY_SHA256}`,
    `x-amz-date:${amzDate}`,
    "",
  ].join("\n");
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    EMPTY_BODY_SHA256,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": EMPTY_BODY_SHA256,
    "x-amz-date": amzDate,
  };
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

  if (response.status === 404 || response.status === 410) return;
  if (!response.ok) {
    throw new Error(await workerErrorMessage("delete", response));
  }
}

export async function deleteAwsHouseImageObject({
  accessKeyId,
  bucket,
  fetchImpl = fetch,
  imageName,
  imageUrl,
  region,
  secretAccessKey,
}: AwsS3Config & {
  fetchImpl?: typeof fetch;
  imageName: string;
  imageUrl?: string | null;
}) {
  const key = keyFromS3ImageUrl({ bucket, imageUrl, region }) ?? validateAwsS3ImageKey(imageName);
  const url = new URL(s3PublicUrl(region, bucket, key));
  const response = await fetchImpl(url, {
    headers: signedS3Headers({ accessKeyId, bucket, method: "DELETE", region, secretAccessKey, url }),
    method: "DELETE",
  });

  if (response.status === 404 || response.status === 410) return;
  if (!response.ok) {
    throw new Error(await workerErrorMessage("delete", response));
  }

  const verifyResponse = await fetchImpl(url, {
    cache: "no-store",
    headers: signedS3Headers({ accessKeyId, bucket, method: "HEAD", region, secretAccessKey, url }),
    method: "HEAD",
  });

  if (verifyResponse.status === 404 || verifyResponse.status === 410) return;
  if (verifyResponse.ok) {
    throw new Error(
      `ยังลบรูป AWS ไม่สำเร็จ เพราะตรวจพบว่ารูปยังอยู่ใน S3 หลังลบ (${responseSummary("DELETE", response)}, ${responseSummary("verify HEAD", verifyResponse)})`,
    );
  }
  throw new Error(await workerErrorMessage("verify delete", verifyResponse));
}
