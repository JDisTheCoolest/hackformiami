import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function CameraView() {
  const [frame, setFrame] = useState<string | null>(null);
  const [status, setStatus] = useState("Waiting for camera...");
  useEffect(() => {
    let stopped = false;
    let previous: string | null = null;
    async function refresh() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("Please sign in to view the camera");
        const response = await fetch("/api/camera/snapshot", {
          headers: { Authorization: "Bearer " + data.session.access_token },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(response.status === 404 ? "No camera image yet" : "Camera unavailable");
        const url = URL.createObjectURL(await response.blob());
        if (stopped) { URL.revokeObjectURL(url); return; }
        setFrame(url); setStatus("Latest camera snapshot · refreshed every 10 seconds");
        if (previous) URL.revokeObjectURL(previous);
        previous = url;
      } catch (error) {
        if (!stopped) setStatus(error instanceof Error ? error.message : "Camera unavailable");
      }
    }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 10000);
    return () => { stopped = true; window.clearInterval(timer); if (previous) URL.revokeObjectURL(previous); };
  }, []);
  return <section className="mx-auto my-10 max-w-3xl rounded-2xl border border-foam/15 bg-deep p-5">
    <h2 className="text-xl font-semibold text-foam">Local monitoring camera</h2>
    <p className="my-3 text-sm text-mist">{status}</p>
    {frame ? <img src={frame} alt="Most recent camera frame" className="w-full rounded-xl" /> :
      <div className="grid aspect-video place-items-center rounded-xl bg-abyss text-mist">No image available</div>}
    <p className="mt-3 text-xs text-mist">Authenticated snapshot preview, not a live video stream. The separate AI analysis can be paused from the Raspberry Pi manager.</p>
  </section>;
}
