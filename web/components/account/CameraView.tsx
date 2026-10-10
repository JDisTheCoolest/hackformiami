import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type CameraEvent = {
  id: string; created_at: string; status: string; source?: string;
  analysis?: { type?: string; severity?: string; confidence?: number; summary?: { en?: string } };
  error?: string;
};
type AlertItem = { id: string; lat: number; lng: number; type: string; message?: { en?: string }; count?: number; unverified?: boolean };

function distanceKm(lat1:number, lng1:number, lat2:number, lng2:number) {
  const rad=Math.PI/180;
  const dLat=(lat2-lat1)*rad, dLng=(lng2-lng1)*rad;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLng/2)**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(a)));
}
export function CameraView() {
  const [frame,setFrame]=useState<string|null>(null);
  const [status,setStatus]=useState("Waiting for camera...");
  const [events,setEvents]=useState<CameraEvent[]>([]);
  const [alerts,setAlerts]=useState<AlertItem[]>([]);
  const [position,setPosition]=useState<{lat:number;lng:number}|null>(null);
  const [locationStatus,setLocationStatus]=useState("Showing all alerts. Location permission is optional.");
  useEffect(()=>{
    let stopped=false;
    let previous:string|null=null;
    let busy=false;
    const refresh=async()=>{
      if(busy)return;
      busy=true;
      try {
        const {data}=await supabase.auth.getSession();
        if(!data.session)throw new Error("Please sign in to view camera");
        const headers={Authorization:"Bearer "+data.session.access_token};
        const [photo,reports,latest]=await Promise.all([
          fetch("/api/camera/snapshot",{headers,cache:"no-store"}),
          fetch("/api/reports?hours=24",{cache:"no-store"}),
          fetch("/api/alerts",{cache:"no-store"})
        ]);
        if(reports.ok) {
          const rows:CameraEvent[]=await reports.json();
          if(!stopped)setEvents(rows.filter(r=>r.source==="camera").slice(0,30));
        }
        if(latest.ok) {
          const rows:AlertItem[]=await latest.json();
          if(!stopped)setAlerts(rows.slice(0,50));
        }
        if(!photo.ok)throw new Error(photo.status===404?"No frame captured yet":"Camera unavailable ("+photo.status+")");
        const next=URL.createObjectURL(await photo.blob());
        if(stopped){URL.revokeObjectURL(next);return;}
        setFrame(next);
        setStatus("Latest snapshot · refreshes every 10 seconds");
        if(previous)URL.revokeObjectURL(previous);
        previous=next;
      }catch(error){if(!stopped)setStatus(error instanceof Error?error.message:"Camera unavailable");}
      finally{busy=false;}
    };
    void refresh();
    const timer=window.setInterval(()=>{void refresh();},10000);
    return ()=>{stopped=true;window.clearInterval(timer);if(previous)URL.revokeObjectURL(previous);};
  },[]);
  const requestLocation=()=>{
    if(!navigator.geolocation){setLocationStatus("This browser does not support location.");return;}
    navigator.geolocation.getCurrentPosition(p=>{
      setPosition({lat:p.coords.latitude,lng:p.coords.longitude});
      setLocationStatus("Showing alerts within 2 km. Your coordinates remain in this browser.");
    },()=>setLocationStatus("Location denied or unavailable; showing all alerts."),{timeout:12000,maximumAge:60000});
  };
  const shown=position?alerts.filter(a=>Number.isFinite(a.lat)&&Number.isFinite(a.lng)&&distanceKm(position.lat,position.lng,a.lat,a.lng)<=2):alerts;
  return <div className="mx-auto my-10 max-w-3xl space-y-6 text-left">
    <section className="rounded-2xl border border-foam/15 bg-deep p-5">
      <h2 className="text-xl font-semibold">Monitoring camera</h2>
      <p className="my-3 text-sm text-mist">{status}</p>
      {frame?<img src={frame} alt="Most recent monitoring camera frame" className="w-full rounded-xl"/>:
        <div className="grid aspect-video place-items-center rounded-xl bg-abyss text-mist">No camera image available</div>}
      <p className="mt-3 text-xs text-mist">Authenticated snapshots only, not live video. The Pi manager can pause AI without stopping camera previews.</p>
    </section>
    <section className="rounded-2xl border border-foam/15 bg-deep p-5">
      <h2 className="text-xl font-semibold">AI detection log</h2>
      <p className="my-2 text-sm text-mist">Classification, confidence and model-generated summaries—not hidden model reasoning.</p>
      <div className="max-h-80 space-y-2 overflow-y-auto">{events.length?events.map(e=>
        <div key={e.id} className="rounded-lg bg-abyss p-3 text-sm">
          <div className="font-semibold text-cyan">{e.created_at} · {e.status} · {e.analysis?.type||"Not classified"}</div>
          <div className="text-mist">Severity: {e.analysis?.severity||"—"} · Confidence: {typeof e.analysis?.confidence==="number"?Math.round(e.analysis.confidence*100)+"%":"—"}</div>
          <p>{e.analysis?.summary?.en||e.error||"Waiting for analysis"}</p>
        </div>):<p className="text-sm text-mist">No camera analysis recorded.</p>}</div>
    </section>
    <section className="rounded-2xl border border-foam/15 bg-deep p-5">
      <h2 className="text-xl font-semibold">Nearby community alerts</h2>
      <button type="button" onClick={requestLocation} className="my-3 rounded-lg bg-cyan px-4 py-2 font-semibold text-abyss">Use my location</button>
      <p className="mb-3 text-sm text-mist">{locationStatus}</p>
      <div className="space-y-2">{shown.length?shown.slice(0,15).map(a=>
        <div key={a.id} className="rounded-lg bg-abyss p-3 text-sm">
          <span className="font-semibold text-cyan">{a.type}</span> · {a.count??0} reports
          <p>{a.message?.en||"Community alert"}</p>
          <p className="text-xs text-mist">{a.unverified?"Unverified camera detection":"Community-sourced; not independently verified"}</p>
        </div>):<p className="text-sm text-mist">No matching alerts.</p>}</div>
    </section>
  </div>;
}
