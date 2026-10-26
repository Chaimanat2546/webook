import { redirect } from "next/navigation";
import { LoginLocationPrompt } from "../../../components/auth/login-location-prompt";
import { LOGIN_LOCATION_WINDOW_MS, LoginHistoryError } from "../../../lib/login-history";
import { loginHistorySession } from "../../../server/auth/login-history";

export const dynamic="force-dynamic";
async function loadPromptSession() {
  const session=await loginHistorySession().catch(error=>{
    if(error instanceof LoginHistoryError && error.status===401)redirect("/login");
    return null;
  });
  if(!session)redirect("/");
  const record=await session.repository.current(session.actor).catch(()=>null);
  if(!record || record.locationStatus!=="pending")redirect("/");
  const expiresAt=Date.parse(record.loggedInAt)+LOGIN_LOCATION_WINDOW_MS;
  if(expiresAt<=Date.now())redirect("/");
  return {historyId:record.id,userId:session.actor.userId,expiresAt};
}
export default async function LoginLocationPage({searchParams}:{searchParams:Promise<{history?:string | string[]}>}) {
  const prompt=await loadPromptSession();
  const {history}=await searchParams;
  if(history!==prompt.historyId)redirect(`/login/location?history=${encodeURIComponent(prompt.historyId)}`);
  return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10"><LoginLocationPrompt key={prompt.historyId} {...prompt} /></main>;
}
