const HOUSE_IMAGE_PREFIX = "houses/";
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

function decodeImageName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("Invalid image name");
  }
}

export function validateHouseImageObjectKey(value: string): string {
  const trimmed = value.trim();
  const decoded = decodeImageName(trimmed).replace(/\\/g, "/");
  const segments = decoded.split("/");

  if (
    !trimmed ||
    trimmed.startsWith("//") ||
    decoded.includes("://") ||
    !decoded.startsWith(HOUSE_IMAGE_PREFIX) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Invalid image name");
  }

  if (!ALLOWED_EXTENSIONS.some((extension) => decoded.toLowerCase().endsWith(extension))) {
    throw new Error("Invalid image extension");
  }

  return decoded;
}

export const validateHouseImageName = validateHouseImageObjectKey;

export function encodeHouseImagePath(imageName: string): string {
  return validateHouseImageObjectKey(imageName)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildHouseImageUrl(imageName: string, baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) throw new Error("Missing house image base URL");

  return `${base}/${encodeHouseImagePath(imageName)}`;
}
