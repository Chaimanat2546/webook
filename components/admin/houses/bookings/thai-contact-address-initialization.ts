import type { ThaiAddressOption, ThaiAddressSelection } from "@/server/geography/thai-address-types";
import type { ThaiAddressRequestVersions } from "./thai-contact-address-request-versions";

type LookupResult<T> = { ok: true; data: T } | { ok: false };

interface InitializationRequest {
  applyProvinces: (options: ThaiAddressOption[]) => void;
  applyResolved: (selection: ThaiAddressSelection) => void;
  isActive: () => boolean;
  listProvinces: () => Promise<LookupResult<ThaiAddressOption[]>>;
  resolveNames: () => Promise<LookupResult<ThaiAddressSelection>>;
}

export interface ThaiContactAddressInitializationController {
  start(request: InitializationRequest): Promise<void>;
  userChanged(): void;
}

export function createThaiContactAddressInitializationController(versions: ThaiAddressRequestVersions): ThaiContactAddressInitializationController {
  return {
    async start(request) {
      const version = versions.nextInitialization();
      const [provinces, resolved] = await Promise.all([request.listProvinces(), request.resolveNames()]);
      if (!request.isActive()) return;
      if (provinces.ok) request.applyProvinces(provinces.data);
      if (versions.isInitializationCurrent(version) && resolved.ok) request.applyResolved(resolved.data);
    },
    userChanged() { versions.invalidateUserAddressChange(); },
  };
}
