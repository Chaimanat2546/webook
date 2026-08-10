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
    CUM_FLUK_NASA_POOLVILLA: {
      executeOperation(input: CentralUserRpcRequest): Promise<unknown>;
    };
    CUM_VILLA_MEDIA_POOLVILLA: {
      executeOperation(input: CentralUserRpcRequest): Promise<unknown>;
    };
  }
}

export {};
