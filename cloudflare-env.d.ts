import type { CentralUserRpcRequest } from "./server/central-user-manager/contracts";

declare global {
  interface CloudflareEnv {
    CUM_BAAN_POOL_VILLA_STAGING: {
      executeOperation(input: CentralUserRpcRequest): Promise<unknown>;
    };
  }
}

export {};
