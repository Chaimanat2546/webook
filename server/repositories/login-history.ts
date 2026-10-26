// Also imported by the scheduled Worker; contains no framework APIs or secrets.
import type { SupabaseClient } from "@supabase/supabase-js";
import { asLoginRecord, LoginHistoryError, type LoginActor, type LoginHistoryEntry, type RecordLoginInput, type LocationReport, type HistoryScope, type HistoryFilter, type HistoryPage, type DeviceType, type LoginLocationStatus } from "../../lib/login-history.ts";

export interface LoginHistoryRepository {
  record(input: RecordLoginInput, signal?: AbortSignal): Promise<LoginHistoryEntry>;
  current(actor: LoginActor): Promise<LoginHistoryEntry | null>;
  attach(actor: LoginActor, report: LocationReport): Promise<LoginHistoryEntry>;
  list(scope: HistoryScope, filter: HistoryFilter): Promise<HistoryPage>;
  scope(actor: LoginActor): Promise<HistoryScope>;
  sessionActive(actor: LoginActor): Promise<boolean>;
  purgeExpired(): Promise<number>;
}
function dbError(error: { code?: string } | null) {
  if (!error) return;
  const code = error.code;
  const status = code === "28000" ? 401 : code === "42501" ? 403 : code === "P0002" ? 404 : code === "P0001" ? 409 : code === "23514" || code === "22023" || code === "22P02" ? 400 : 503;
  throw new LoginHistoryError(status, status===503 && ["40001","40P01","08006"].includes(code ?? ""));
}
function entry(value: unknown): LoginHistoryEntry {
  const row = asLoginRecord(value);
  const text = (key: string) => typeof row[key] === "string" ? row[key] as string : null;
  const numeric = (key: string) => typeof row[key] === "number" && Number.isFinite(row[key]) ? row[key] as number : null;
  if (!text("id") || !text("user_id") || !text("logged_in_at")) throw new LoginHistoryError(503);
  return {
    id: text("id")!,userId: text("user_id")!,loggedInAt: text("logged_in_at")!,ipAddress: text("ip_address"),
    os: text("os") ?? "unknown",browser: text("browser") ?? "unknown",deviceType: (text("device_type") ?? "unknown") as DeviceType,
    locationStatus: (text("location_status") ?? "pending") as LoginLocationStatus,
    latitude: numeric("latitude"),longitude: numeric("longitude"),accuracy: numeric("accuracy_m"),
    capturedAt: text("location_captured_at"),receivedAt: text("location_received_at"),
    displayName: text("display_name"),username: text("username"),email: text("email"),
  };
}
export function createLoginHistoryRepository(client: SupabaseClient): LoginHistoryRepository {
  return {
    async record(input,signal) {
      const query = client.rpc("login_history_record", { p_user:input.userId,p_session:input.sessionId,p_logged_in_at:input.loggedInAt,p_ip:input.ipAddress,p_os:input.os,p_browser:input.browser,p_device:input.deviceType });
      if (signal) query.abortSignal(signal);
      const { data,error } = await query.single(); dbError(error); return entry(data);
    },
    async current(actor) {
      const { data,error } = await client.rpc("login_history_current",{p_user:actor.userId,p_session:actor.sessionId}).maybeSingle();
      dbError(error); return data === null ? null : entry(data);
    },
    async attach(actor,report) {
      const { data,error } = await client.rpc("login_history_attach", {
        p_user:actor.userId,p_session:actor.sessionId,p_history:report.historyId,p_status:report.status,
        p_latitude:report.status==="success"?report.latitude:null,p_longitude:report.status==="success"?report.longitude:null,
        p_accuracy:report.status==="success"?report.accuracy:null,p_captured_at:report.status==="success"?report.capturedAt:null,
      }).single();
      dbError(error); return entry(data);
    },
    async list(scope,filter) {
      if (scope.kind==="self" && filter.search) throw new LoginHistoryError(403);
      const { data,error } = await client.rpc("login_history_list",{p_actor:scope.userId,p_search:filter.search,p_from:filter.from,p_to:filter.to,p_page:filter.page,p_size:filter.pageSize});
      dbError(error);
      const result=asLoginRecord(data);
      if (!Array.isArray(result.entries) || typeof result.total!=="number") throw new LoginHistoryError(503);
      return { entries:result.entries.map(entry),total:result.total,page:filter.page,pageSize:filter.pageSize };
    },
    async scope(actor) {
      const { data,error } = await client.from("users").select("role_id").eq("uid",actor.userId).maybeSingle();
      dbError(error);
      return { userId:actor.userId,kind:data!==null && asLoginRecord(data).role_id===1?"root-admin":"self" };
    },
    async sessionActive(actor) {
      const { data,error } = await client.rpc("login_history_session_active",{p_user:actor.userId,p_session:actor.sessionId});
      dbError(error); return data===true;
    },
    async purgeExpired() {
      const { data,error }=await client.rpc("login_history_purge"); dbError(error);
      if (typeof data!=="number" || !Number.isInteger(data) || data<0 || data>1000) throw new LoginHistoryError(503);
      return data;
    },
  };
}
