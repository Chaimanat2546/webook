import "server-only";
import { LoginHistoryError, parseLocationReport, type LoginActor } from "../../lib/login-history.ts";
import type { LoginHistoryRepository } from "../repositories/login-history.ts";
import { attachLoginLocation } from "../services/login-history.ts";

function sameOrigin(request:Request):boolean {
  const origin=request.headers.get("origin");
  if(!origin)return false;
  const target=new URL(request.url);
  if(origin===target.origin)return true;
  // Plain Next.js canonicalizes its internal URL to localhost even when the
  // browser opened 127.0.0.1. This exception is restricted to loopback aliases,
  // the same scheme/port, and the actual Host; no forwarded headers are used.
  try {
    const source=new URL(origin);
    const loopback=(host:string)=>["localhost","127.0.0.1","[::1]"].includes(host);
    return source.origin===origin && loopback(source.hostname) && loopback(target.hostname)
      && source.protocol===target.protocol && source.port===target.port && source.host===request.headers.get("host");
  }catch{return false;}
}

async function limitedJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim()!=="application/json"
    || Number(request.headers.get("content-length"))>2048 || !request.body) throw new LoginHistoryError(400);
  const reader=request.body.getReader();
  const chunks: Uint8Array[]=[];
  let length=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      length+=value.byteLength;
      if (length>2048) { await reader.cancel(); throw new LoginHistoryError(400); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body=new Uint8Array(length);
  let offset=0;
  for (const chunk of chunks) {body.set(chunk,offset);offset+=chunk.byteLength;}
  try { return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(body)) as unknown; }
  catch { throw new LoginHistoryError(400); }
}
export async function handleLoginLocation(request: Request,authenticate:()=>Promise<{actor:LoginActor;repository:LoginHistoryRepository}>) {
  const headers={"Cache-Control":"private, no-store"};
  try {
    // Request.url comes from the server ingress. Never trust forwarded-host or
    // an origin supplied inside the JSON body to decide this boundary.
    if (!sameOrigin(request)) throw new LoginHistoryError(403);
    const report=parseLocationReport(await limitedJson(request));
    const {actor,repository}=await authenticate();
    await attachLoginLocation(repository,actor,report);
    return Response.json({saved:true},{headers});
  } catch (error) {
    const status=error instanceof LoginHistoryError?error.status:503;
    return Response.json({error:"ไม่สามารถบันทึกตำแหน่งได้"},{status,headers});
  }
}
