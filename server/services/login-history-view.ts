import { LoginHistoryError, parseHistoryFilter, type HistoryPage, type LoginActor } from "../../lib/login-history.ts";
import { hasHistoryCriteria, type HistoryParams } from "../../lib/login-history-view.ts";
import type { LoginHistoryRepository } from "../repositories/login-history.ts";

export interface HistoryView {
  state: "records" | "default-empty" | "filtered-empty" | "invalid-date" | "invalid-filter" | "load-error" | "forbidden";
  params: HistoryParams;
  result?: HistoryPage;
}
export async function loadHistoryView(repository: Pick<LoginHistoryRepository,"scope"|"list">, actor: LoginActor, query: Record<string,string|string[]|undefined>): Promise<HistoryView> {
  // Reject ambiguous requests below, but keep a visible value for correction.
  // Dropping an array-valued search here would silently broaden the next query.
  const params: HistoryParams = Object.fromEntries(Object.entries(query).map(([key,value]) => [key,Array.isArray(value) ? value[0] : value]));
  try {
    const scope = await repository.scope(actor);
    if (scope.kind !== "root-admin") return { state: "forbidden", params: {} };
    if (Object.values(query).some(Array.isArray)) throw new LoginHistoryError(400);
    const filter = parseHistoryFilter(params);
    let result = await repository.list(scope, filter);
    const last = Math.max(1, Math.ceil(result.total / result.pageSize));
    if (result.total > 0 && filter.page > last) {
      result = await repository.list(scope, { ...filter, page: last });
      params.page = String(last);
    }
    return { state: result.entries.length ? "records" : hasHistoryCriteria(params) ? "filtered-empty" : "default-empty", params, result };
  } catch (error) {
    if (error instanceof LoginHistoryError && error.status === 401) throw error;
    const state = error instanceof LoginHistoryError && error.status === 403 ? "forbidden" : error instanceof LoginHistoryError && error.status === 400 ? error.reason === "invalid_date" ? "invalid-date" : "invalid-filter" : "load-error";
    return { state, params };
  }
}
