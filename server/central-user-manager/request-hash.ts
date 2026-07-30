import "server-only";

import type {
  AgentOperationRequest,
  CentralUserAction,
} from "./contracts.ts";

export type CentralOperationBinding =
  | {
      version: 1;
      tenantId: string;
      actorUid: string;
      action: "list_users";
      payload: { page: number; pageSize: number };
    }
  | {
      version: 1;
      tenantId: string;
      actorUid: string;
      action: Exclude<CentralUserAction, "list_users">;
      payload: { email: string };
    };

type WebCryptoDependency = Pick<Crypto, "subtle">;

export function toCentralOperationBinding(
  request: AgentOperationRequest,
): CentralOperationBinding {
  if (request.action === "list_users") {
    return {
      version: 1,
      tenantId: request.tenantId,
      actorUid: request.actorUid,
      action: request.action,
      payload: {
        page: request.payload.page,
        pageSize: request.payload.pageSize,
      },
    };
  }

  return {
    version: 1,
    tenantId: request.tenantId,
    actorUid: request.actorUid,
    action: request.action,
    payload: { email: request.payload.email },
  };
}

export async function hashCentralOperationBinding(
  binding: CentralOperationBinding,
  cryptoDependency: WebCryptoDependency = globalThis.crypto,
): Promise<string> {
  const canonical =
    binding.action === "list_users"
      ? {
          version: 1,
          tenantId: binding.tenantId,
          actorUid: binding.actorUid,
          action: binding.action,
          payload: {
            page: binding.payload.page,
            pageSize: binding.payload.pageSize,
          },
        }
      : {
          version: 1,
          tenantId: binding.tenantId,
          actorUid: binding.actorUid,
          action: binding.action,
          payload: { email: binding.payload.email },
        };
  const digest = new Uint8Array(
    await cryptoDependency.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(canonical)),
    ),
  );

  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
