const IMAGE_NAME_TIME_ZONE = "Asia/Bangkok";
const RANDOM_SUFFIX_BYTES = 5;

const extensionByMimeType: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: IMAGE_NAME_TIME_ZONE,
  year: "numeric",
});

export interface ManagedImageNameOptions {
  now?: Date;
  randomHex?: string;
}

function formatTimestamp(value: Date): string {
  if (Number.isNaN(value.getTime())) throw new Error("Invalid image timestamp");

  const parts = Object.fromEntries(
    timestampFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

function randomHexSuffix(): string {
  const bytes = new Uint8Array(RANDOM_SUFFIX_BYTES);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getImageExtension(mimeType: string): string {
  const extension = extensionByMimeType[mimeType];
  if (!extension) throw new Error("Unsupported image type");
  return extension;
}

export function isSupportedImageMimeType(mimeType: string): boolean {
  return Boolean(extensionByMimeType[mimeType]);
}

export function buildManagedImageFileName(
  mimeType: string,
  options: ManagedImageNameOptions = {},
): string {
  const extension = getImageExtension(mimeType);
  const randomHex = (options.randomHex ?? randomHexSuffix()).toLowerCase();

  if (!/^[0-9a-f]{10}$/.test(randomHex)) throw new Error("Invalid image random suffix");

  return `${formatTimestamp(options.now ?? new Date())}_${randomHex}.${extension}`;
}

export function validateManagedImageFileName(value: string): string {
  const trimmed = value.trim();

  if (
    !trimmed ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("://") ||
    trimmed === "." ||
    trimmed === ".." ||
    trimmed.includes("..")
  ) {
    throw new Error("Invalid image name");
  }

  if (!/^\d{14}_[0-9a-f]{10}\.(?:avif|gif|jpe?g|png|webp)$/i.test(trimmed)) {
    throw new Error("Invalid image name");
  }

  return trimmed;
}
