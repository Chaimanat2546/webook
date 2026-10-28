import type { LoginHistoryRepository } from "../repositories/login-history.ts";
import { LoginHistoryError, type RecordLoginInput, type LoginActor, type LocationReport, type HistoryFilter, type HistoryScope } from "../../lib/login-history.ts";

export async function recordSuccessfulLogin(repository: Pick<LoginHistoryRepository,"record">,input: RecordLoginInput,budgetMs=3000) {
  const controller=new AbortController();
  const deadline=setTimeout(() => controller.abort(),budgetMs);
  try {
    try { return await repository.record(input,controller.signal); }
    catch (error) {
      if (!(error instanceof LoginHistoryError) || !error.transient || controller.signal.aborted) throw error;
      return await repository.record(input,controller.signal);
    }
  } finally { clearTimeout(deadline); }
}
export async function attachLoginLocation(repository: LoginHistoryRepository,actor: LoginActor,report: LocationReport) {
  return repository.attach(actor,report);
}
export async function listLoginHistory(repository: LoginHistoryRepository,scope: HistoryScope,filter: HistoryFilter) {
  if (scope.kind !== "root-admin") throw new LoginHistoryError(403);
  return repository.list(scope,filter);
}
export async function purgeExpiredLoginHistory(repository: Pick<LoginHistoryRepository,"purgeExpired">) {
  return repository.purgeExpired();
}
