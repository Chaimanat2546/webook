import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { pushConfig, type PushBindings, type PushConfig } from "./web-push";

export async function getPushRuntimeConfig(): Promise<PushConfig | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return pushConfig(env as unknown as PushBindings);
  } catch {
    return pushConfig(process.env as PushBindings);
  }
}
