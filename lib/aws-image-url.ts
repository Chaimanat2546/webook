const AWS_IMAGE_BASE_URL =
  "https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

function decodeImageName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("Invalid image name");
  }
}

export function buildAwsImageUrl(imageName: string): string {
  const trimmed = imageName.trim();
  const decoded = decodeImageName(trimmed).replace(/\\/g, "/");

  if (!trimmed || trimmed.startsWith("//") || decoded.includes("/")) {
    throw new Error("Invalid image name");
  }

  if (!ALLOWED_EXTENSIONS.some((extension) => decoded.toLowerCase().endsWith(extension))) {
    throw new Error("Invalid image extension");
  }

  return `${AWS_IMAGE_BASE_URL}/${encodeURIComponent(decoded)}`;
}

export const awsImageHostname = new URL(AWS_IMAGE_BASE_URL).hostname;
