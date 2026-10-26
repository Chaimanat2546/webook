import "server-only";
import { isIP } from "node:net";
import { actorFromClaims, classifyLoginDevice, LoginHistoryError, type LoginActor } from "../../lib/login-history.ts";
import { createLoginHistoryRepository } from "../repositories/login-history.ts";
import { recordSuccessfulLogin } from "../services/login-history.ts";

interface LoginAuthVerifier {
  getClaims(token: string): Promise<{data:{claims:unknown}|null;error:unknown}>;
  getUser(token: string): Promise<{data:{user:{id:string}|null};error:unknown}>;
}
export async function verifyLoginActor(auth: LoginAuthVerifier,accessToken: string): Promise<LoginActor> {
  if (!accessToken) throw new LoginHistoryError(401);
  const [claims,user]=await Promise.all([auth.getClaims(accessToken),auth.getUser(accessToken)]);
  if (claims.error || user.error || !claims.data || !user.data.user) throw new LoginHistoryError(401);
  return actorFromClaims(claims.data.claims,user.data.user.id);
}
export function loginRequestIp(headers: Pick<Headers,"get">,trustedIngress: boolean): string | null {
  if (!trustedIngress) return null;
  const value=headers.get("cf-connecting-ip");
  return value && isIP(value) ? value : null;
}
async function historyRepository() {
  const {createSupabaseAdminClient}=await import("../../lib/supabase/admin.ts");
  const client=createSupabaseAdminClient();
  if (!client) throw new LoginHistoryError(503);
  return createLoginHistoryRepository(client);
}
export async function loginHistorySession() {
  const {createSupabaseServerClient}=await import("../../lib/supabase/server.ts");
  const client=await createSupabaseServerClient();
  const {data,error}=await client.auth.getSession();
  if (error || !data.session) throw new LoginHistoryError(401);
  const actor=await verifyLoginActor(client.auth,data.session.access_token);
  const repository=await historyRepository();
  if (!await repository.sessionActive(actor)) throw new LoginHistoryError(401);
  return {actor,repository};
}
export async function requireLoginActor() { return (await loginHistorySession()).actor; }
export async function resolveHistoryScope(actor: LoginActor) { return (await historyRepository()).scope(actor); }

/** Best effort audit persistence. Auth success never depends on metadata storage. */
export async function recordSignedInSession(auth: LoginAuthVerifier,accessToken: string,expectedUserId: string,requestHeaders: Pick<Headers,"get">) {
  try {
    const loggedInAt=new Date().toISOString();
    const actor=await verifyLoginActor(auth,accessToken);
    if (actor.userId!==expectedUserId) throw new LoginHistoryError(401);
    let trustedIngress=false;
    if (process.env.NODE_ENV==="production") {
      try {
        const {getCloudflareContext}=await import("@opennextjs/cloudflare");
        getCloudflareContext(); trustedIngress=true;
      } catch { /* Plain Next.js and local development have no trusted edge IP. */ }
    }
    return await recordSuccessfulLogin(await historyRepository(),{
      ...actor,loggedInAt,ipAddress:loginRequestIp(requestHeaders,trustedIngress),
      ...classifyLoginDevice(requestHeaders.get("user-agent")),
    });
  } catch {
    console.warn("login_history_record_failed");
    return null;
  }
}
