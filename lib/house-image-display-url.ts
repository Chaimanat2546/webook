import { buildAwsImageUrl } from "./aws-image-url.ts";

export interface HouseImageDisplaySource {
  imageName: string | null | undefined;
  imageUrl: string | null | undefined;
}

function isManagedR2HouseImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".workers.dev") && url.pathname.startsWith("/houses/");
  } catch {
    return false;
  }
}

export function buildHouseImageDisplayUrl({ imageName, imageUrl }: HouseImageDisplaySource): string | null {
  const url = imageUrl?.trim() || null;
  if (url && isManagedR2HouseImageUrl(url)) return url;

  if (imageName) {
    try {
      return buildAwsImageUrl(imageName);
    } catch {
      return null;
    }
  }

  return null;
}
