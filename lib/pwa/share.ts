export interface ShareLinkData {
  title: string;
  url: string;
}

export interface ShareCapabilities {
  canShare?: (data: ShareLinkData) => boolean;
  share?: (data: ShareLinkData) => Promise<void>;
  copy?: (text: string) => Promise<void>;
}

export type ShareLinkOutcome = "shared" | "copied" | "cancelled" | "manual";

export async function shareLink(
  data: ShareLinkData,
  capabilities: ShareCapabilities,
): Promise<ShareLinkOutcome> {
  try {
    if (capabilities.share && (!capabilities.canShare || capabilities.canShare(data))) {
      await capabilities.share(data);
      return "shared";
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "cancelled";
  }
  try {
    if (capabilities.copy) {
      await capabilities.copy(data.url);
      return "copied";
    }
  } catch {
    // A visible, selectable link remains usable without browser permissions.
  }
  return "manual";
}
