import type { LocationReport } from "../../lib/login-history.ts";

export type LocationRequestState="idle" | "reading" | "saving" | "saved" | "failed" | "denied" | "unavailable" | "timeout" | "unsupported";
interface LocationRequestOptions {
  historyId:string;
  geolocation:Pick<Geolocation,"getCurrentPosition"> | null;
  save:(report:LocationReport,signal:AbortSignal)=>Promise<boolean>;
  onState:(state:LocationRequestState)=>void;
  deadline?:(expire:()=>void)=>()=>void;
}
/** Owns one explicit location attempt. Coordinates stay in memory until save. */
export function createLoginLocationRequest(options:LocationRequestOptions) {
  let started=false,finished=false,disposed=false,saving=false;
  let report:LocationReport | null=null;
  let stopDeadline=()=>{};
  let controller:AbortController | null=null;
  async function persist() {
    if(disposed || saving || !report)return;
    saving=true;
    controller=new AbortController();
    const requestController=controller;
    const timeout=setTimeout(()=>requestController.abort(),10000);
    options.onState("saving");
    try {
      const locationStatus=report.status;
      const saved=await options.save(report,requestController.signal);
      if(!disposed){
        if(saved)report=null;
        options.onState(saved?(locationStatus==="success" || locationStatus==="skipped"?"saved":locationStatus):"failed");
      }
    } catch { if(!disposed)options.onState("failed"); }
    finally {clearTimeout(timeout);saving=false;}
  }
  function finish(value:LocationReport) {
    if(disposed || finished)return;
    finished=true;stopDeadline();report=value;
    void persist();
  }
  return {
    share() {
      if(started || disposed)return;
      started=true;
      if(!options.geolocation){finish({historyId:options.historyId,status:"unsupported"});return;}
      options.onState("reading");
      const expire=()=>finish({historyId:options.historyId,status:"timeout"});
      stopDeadline=options.deadline?options.deadline(expire):(()=>{const timer=setTimeout(expire,15000);return()=>clearTimeout(timer);})();
      try {
        options.geolocation.getCurrentPosition(position=>{
          if(disposed || finished)return;
          if(!Number.isFinite(position.timestamp)){finish({historyId:options.historyId,status:"unavailable"});return;}
          finish({historyId:options.historyId,status:"success",latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,capturedAt:new Date(position.timestamp).toISOString()});
        },error=>finish({historyId:options.historyId,status:error.code===1?"denied":error.code===3?"timeout":"unavailable"}),{maximumAge:0,timeout:10000,enableHighAccuracy:false});
      } catch {finish({historyId:options.historyId,status:"unavailable"});}
    },
    skip() {if(started || disposed)return;started=true;finish({historyId:options.historyId,status:"skipped"});},
    retry() {void persist();},
    cancel() {disposed=true;report=null;stopDeadline();controller?.abort();},
  };
}
