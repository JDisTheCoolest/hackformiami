import { Expand, RefreshCw, Video, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { supabase } from "@/lib/supabase";

type CameraEvent = { id:string; created_at:string; status:string; source?:string; analysis?:{type?:string;severity?:string;confidence?:number;summary?:{en?:string}}; error?:string };
type AlertItem = { id:string; lat:number; lng:number; type:string; message?:{en?:string}; count?:number; unverified?:boolean };
type CameraStatus = { connected:boolean; capture_fps:number; target_fps:number; width:number; height:number; frames:number; drops:number; updated_at:number; viewers:number; max_viewers:number };
type Quality = "data-saver" | "balanced" | "smooth";
const qualityFps: Record<Quality, number> = { "data-saver": 5, balanced: 10, smooth: 15 };
function distanceKm(lat1:number,lng1:number,lat2:number,lng2:number){const r=Math.PI/180,dLat=(lat2-lat1)*r,dLng=(lng2-lng1)*r;const a=Math.sin(dLat/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(a)));}

export function CameraView(){
  const [streamUrl,setStreamUrl]=useState<string|null>(null),[streamState,setStreamState]=useState<"connecting"|"live"|"offline">("connecting");
  const [message,setMessage]=useState("Authorizing secure camera stream…"),[quality,setQuality]=useState<Quality>("smooth"),[retry,setRetry]=useState(0);
  const [cameraStatus,setCameraStatus]=useState<CameraStatus|null>(null),[events,setEvents]=useState<CameraEvent[]>([]),[alerts,setAlerts]=useState<AlertItem[]>([]);
  const [position,setPosition]=useState<{lat:number;lng:number}|null>(null),[locationStatus,setLocationStatus]=useState("Showing all alerts. Location permission is optional.");
  const videoBox=useRef<HTMLDivElement>(null);
  const sessionHeaders=useCallback(async()=>{const {data}=await supabase.auth.getSession();if(!data.session)throw new Error("Please sign in to view camera");return {Authorization:`Bearer ${data.session.access_token}`};},[]);

  useEffect(()=>{
    let stopped=false;
    const connect=async()=>{setStreamState("connecting");setMessage("Authorizing secure camera stream…");setStreamUrl(null);try{
      const headers=await sessionHeaders();
      const response=await fetch(`${API_BASE}/api/camera/stream-session`,{method:"POST",headers,credentials:"same-origin"});
      if(!response.ok)throw new Error(response.status===401?"Your camera session expired.":`Camera authorization failed (${response.status}).`);
      if(!stopped)setStreamUrl(`${API_BASE}/api/camera/stream?fps=${qualityFps[quality]}&v=${Date.now()}`);
    }catch(error){if(!stopped){setStreamState("offline");setMessage(error instanceof Error?error.message:"Camera unavailable");}}};
    void connect();return()=>{stopped=true;setStreamUrl(null);};
  },[quality,retry,sessionHeaders]);

  useEffect(()=>{
    let stopped=false;
    const refresh=async()=>{try{const headers=await sessionHeaders();const response=await fetch(`${API_BASE}/api/camera/status`,{headers,cache:"no-store"});if(response.ok&&!stopped)setCameraStatus(await response.json());}catch{/* Stream error UI remains authoritative. */}};
    void refresh();const timer=window.setInterval(()=>void refresh(),2000);return()=>{stopped=true;window.clearInterval(timer);};
  },[sessionHeaders]);

  useEffect(()=>{
    let stopped=false;
    const refreshActivity=async()=>{try{const [reports,latest]=await Promise.all([fetch(`${API_BASE}/api/reports?hours=24`,{cache:"no-store"}),fetch(`${API_BASE}/api/alerts`,{cache:"no-store"})]);if(reports.ok){const rows:CameraEvent[]=await reports.json();if(!stopped)setEvents(rows.filter(r=>r.source==="camera").slice(0,30));}if(latest.ok){const rows:AlertItem[]=await latest.json();if(!stopped)setAlerts(rows.slice(0,50));}}catch{/* Camera stream remains available if activity APIs fail. */}};
    void refreshActivity();const timer=window.setInterval(()=>void refreshActivity(),10000);return()=>{stopped=true;window.clearInterval(timer);};
  },[]);

  const requestLocation=()=>{if(!navigator.geolocation){setLocationStatus("This browser does not support location.");return;}navigator.geolocation.getCurrentPosition(p=>{setPosition({lat:p.coords.latitude,lng:p.coords.longitude});setLocationStatus("Showing alerts within 2 km. Your coordinates remain in this browser.");},()=>setLocationStatus("Location denied or unavailable; showing all alerts."),{timeout:12000,maximumAge:60000});};
  const shown=position?alerts.filter(a=>Number.isFinite(a.lat)&&Number.isFinite(a.lng)&&distanceKm(position.lat,position.lng,a.lat,a.lng)<=2):alerts;
  const fps=cameraStatus?.capture_fps??0;

  return <div className="mx-auto my-10 max-w-3xl space-y-6 text-left">
    <section className="rounded-2xl border border-foam/15 bg-deep p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><h2 className="text-xl font-semibold">Monitoring camera</h2><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${streamState==="live"?"bg-red-500/15 text-red-300":"bg-foam/10 text-mist"}`}><span className={`size-2 rounded-full ${streamState==="live"?"animate-pulse bg-red-400":"bg-mist"}`}/>{streamState==="live"?"LIVE":streamState.toUpperCase()}</span></div><div className="flex gap-2"><select aria-label="Video quality" value={quality} onChange={e=>setQuality(e.target.value as Quality)} className="rounded-lg border border-foam/20 bg-abyss px-3 py-2 text-sm"><option value="data-saver">Data saver · 5 FPS</option><option value="balanced">Balanced · 10 FPS</option><option value="smooth">Smooth · 15 FPS</option></select><button type="button" title="Reconnect" onClick={()=>setRetry(value=>value+1)} className="rounded-lg border border-foam/20 p-2.5 hover:bg-foam/10"><RefreshCw className="size-4"/></button><button type="button" title="Fullscreen" onClick={()=>void videoBox.current?.requestFullscreen()} className="rounded-lg border border-foam/20 p-2.5 hover:bg-foam/10"><Expand className="size-4"/></button></div></div>
      <p className="my-3 text-sm text-mist">{message} {cameraStatus&&`· ${fps.toFixed(1)} camera FPS · ${cameraStatus.width}×${cameraStatus.height} · ${cameraStatus.viewers}/${cameraStatus.max_viewers} viewers`}</p>
      <div ref={videoBox} className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-xl bg-abyss">{streamUrl?<img src={streamUrl} alt="Live monitoring camera" className="size-full object-contain" onLoad={()=>{setStreamState("live");setMessage("Secure stream connected");}} onError={()=>{setStreamState("offline");setMessage("Camera stream disconnected. Reconnect to try again.");setStreamUrl(null);}}/>:<div className="grid place-items-center gap-3 text-mist">{streamState==="offline"?<WifiOff className="size-8"/>:<Video className="size-8 animate-pulse"/>}<span>{message}</span></div>}</div>
      <p className="mt-3 text-xs text-mist">Authenticated MJPEG preview. The browser receives no Supabase token in the URL; pausing AI does not stop video. Actual latency and sustainable FPS must be measured on the Raspberry Pi.</p>
    </section>
    <section className="rounded-2xl border border-foam/15 bg-deep p-5"><h2 className="text-xl font-semibold">AI detection log</h2><p className="my-2 text-sm text-mist">Classification, confidence and model-generated summaries—not hidden model reasoning.</p><div className="max-h-80 space-y-2 overflow-y-auto">{events.length?events.map(e=><div key={e.id} className="rounded-lg bg-abyss p-3 text-sm"><div className="font-semibold text-cyan">{e.created_at} · {e.status} · {e.analysis?.type||"Not classified"}</div><div className="text-mist">Severity: {e.analysis?.severity||"—"} · Confidence: {typeof e.analysis?.confidence==="number"?Math.round(e.analysis.confidence*100)+"%":"—"}</div><p>{e.analysis?.summary?.en||e.error||"Waiting for analysis"}</p></div>):<p className="text-sm text-mist">No camera analysis recorded.</p>}</div></section>
    <section className="rounded-2xl border border-foam/15 bg-deep p-5"><h2 className="text-xl font-semibold">Nearby community alerts</h2><button type="button" onClick={requestLocation} className="my-3 rounded-lg bg-cyan px-4 py-2 font-semibold text-abyss">Use my location</button><p className="mb-3 text-sm text-mist">{locationStatus}</p><div className="space-y-2">{shown.length?shown.slice(0,15).map(a=><div key={a.id} className="rounded-lg bg-abyss p-3 text-sm"><span className="font-semibold text-cyan">{a.type}</span> · {a.count??0} reports<p>{a.message?.en||"Community alert"}</p><p className="text-xs text-mist">{a.unverified?"Unverified camera detection":"Community-sourced; not independently verified"}</p></div>):<p className="text-sm text-mist">No matching alerts.</p>}</div></section>
  </div>;
}
