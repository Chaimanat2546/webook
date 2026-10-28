import Image from "next/image";
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
  return {historyId:record.id,userId:session.actor.userId,sessionId:session.actor.sessionId,expiresAt};
}
export default async function LoginLocationPage({searchParams}:{searchParams:Promise<{history?:string | string[]}>}) {
  const prompt=await loadPromptSession();
  const {history}=await searchParams;
  if(history!==prompt.historyId)redirect(`/login/location?history=${encodeURIComponent(prompt.historyId)}`);
  return <main className="min-h-dvh bg-background px-4 pt-20 pb-10"><div className="mx-auto w-full max-w-[358px]"><div className="mb-8 flex items-center justify-center gap-2.5"><Image src="/brand/webooks-logo-transparent.png" width={500} height={500} alt="โลโก้ WeBooks" className="size-9 object-contain" /><span className="text-xl font-bold">WeBooks</span></div><LoginLocationPrompt key={prompt.historyId} {...prompt} /></div></main>;
}
