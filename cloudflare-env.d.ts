import type { CentralUserRpcRequest } from "./server/central-user-manager/contracts";

declare global {
  interface CloudflareEnv {
    CUM_BAANPARTY: {
      executeOperation(input: CentralUserRpcRequest): Promise<unknown>;
    };
    CUM_POOLVILLAPATTAYA: {
      executeOperation(input: CentralUserRpcRequest): Promise<unknown>;
    };
    CUM_BAANPMHEE: {
      executeOperation(input: CentralUserRpcRequest): Promise<unknown>;
    };
  }
}

export {};
