import type { CentralUserRpcRequest } from "./server/central-user-manager/contracts";

declare global {
  interface CloudflareEnv {
    CUM_BAANPARTY: {
      executeOperation(input: CentralUserRpcRequest): Promise<unknown>;
    };
  }
}

export {};
