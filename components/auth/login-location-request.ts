import type { LocationReport } from "../../lib/login-history.ts";

export type LocationRequestState="idle" | "reading" | "saving" | "saved" | "failed" | "denied" | "unavailable" | "timeout" | "unsupported";
interface LocationRequestOptions {
  historyId:string;
  geolocation:(Pick<Geolocation,"getCurrentPosition"> & Partial<Pick<Geolocation,"watchPosition" | "clearWatch">>) | null;
  minimumCapturedAt?:number;
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
  let watchId:number | null=null;
  let waitingForFresh=false;
  function clearWatch(id:number) {
    try{options.geolocation?.clearWatch?.(id);}catch{/* Native cleanup is best effort. */}
  }
  function stopWatch() {
    if(watchId===null)return;
    const id=watchId;watchId=null;clearWatch(id);
  }
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
    finished=true;stopDeadline();stopWatch();report=value;
    void persist();
  }
  function locationError(error:GeolocationPositionError) {
    finish({historyId:options.historyId,status:error.code===1?"denied":error.code===3?"timeout":"unavailable"});
  }
  function positionReceived(position:GeolocationPosition) {
    if(disposed || finished)return;
    if(!Number.isFinite(position.timestamp)){finish({historyId:options.historyId,status:"unavailable"});return;}
    if(options.minimumCapturedAt!==undefined && position.timestamp<options.minimumCapturedAt){
      if(waitingForFresh)return;
      waitingForFresh=true;
      const geo=options.geolocation;
      if(!geo?.watchPosition || !geo.clearWatch){finish({historyId:options.historyId,status:"unavailable"});return;}
      try{
        const id=geo.watchPosition(positionReceived,locationError,{maximumAge:0,timeout:10000,enableHighAccuracy:false});
        if(disposed || finished)clearWatch(id);else watchId=id;
      }catch{finish({historyId:options.historyId,status:"unavailable"});}
      return;
    }
    finish({historyId:options.historyId,status:"success",latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,capturedAt:new Date(position.timestamp).toISOString()});
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
        options.geolocation.getCurrentPosition(positionReceived,locationError,{maximumAge:0,timeout:10000,enableHighAccuracy:false});
      } catch {finish({historyId:options.historyId,status:"unavailable"});}
    },
    skip() {if(started || disposed)return;started=true;finish({historyId:options.historyId,status:"skipped"});},
    retry() {void persist();},
    cancel() {disposed=true;report=null;stopDeadline();stopWatch();controller?.abort();},
  };
}
