import {
  Bell, Bookmark, Home, LogOut, Map, MapPin, Menu, RadioTower,
  Settings, ShieldAlert, User, X, FileWarning,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { EyeMark } from "@/components/brand/EyeMark";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Home", to: "/app/", icon: Home, end: true },
  { label: "Map", to: "/app/#map", icon: Map },
  { label: "Reports", to: "/reports", icon: FileWarning },
  { label: "Alerts", to: "/alerts", icon: ShieldAlert },
  { label: "Saved locations", to: "/account#saved-locations", icon: Bookmark },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

function Brand() {
  return <span className="flex items-baseline text-xl font-semibold tracking-[-0.05em] text-foam" aria-label="4forces">4f<EyeMark className="mx-px h-[15px] w-[15px]" track={false} />rces</span>;
}

export function AppShell({ children, title = "Miami overview", eyebrow = "Live awareness" }: { children: ReactNode; title?: string; eyebrow?: string }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => setMenuOpen(false), [location.pathname, location.hash]);
  async function logout() { await signOut(); navigate("/login", { replace: true }); }
  const nav = (mobile = false) => navigation.map(({ label, to, icon: Icon, ...item }) => (
    <NavLink key={label} to={to} end={"end" in item && item.end} className={({ isActive }) => cn(
      mobile ? "flex min-w-14 flex-col items-center gap-1 text-[10px]" : "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
      isActive || (label === "Map" && location.hash === "#map") ? "bg-cyan/10 text-cyan" : "text-mist hover:bg-foam/[0.05] hover:text-foam",
    )}><Icon className={mobile ? "size-5" : "size-[18px]"} /><span>{label}</span></NavLink>
  ));

  return <div className="min-h-dvh bg-[radial-gradient(ellipse_at_70%_0%,rgba(40,104,255,.13),transparent_38%),#030814] text-foam">
    <aside className="fixed inset-y-0 left-0 z-[800] hidden w-64 flex-col border-r hairline bg-[#051126]/95 px-4 py-6 backdrop-blur-xl lg:flex">
      <Link to="/app/" className="px-3"><Brand /></Link>
      <div className="mt-3 flex items-center gap-2 px-3 text-[11px] uppercase tracking-[.16em] text-dim"><RadioTower className="size-3 text-sev-none" /> Miami network live</div>
      <nav className="mt-10 space-y-1">{nav()}</nav>
      <div className="mt-auto rounded-2xl border hairline bg-foam/[0.035] p-3">
        <Link to="/account" className="flex min-w-0 items-center gap-3 rounded-xl p-2 hover:bg-foam/[0.05]"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-electric/20 text-cyan"><User className="size-4" /></span><span className="min-w-0"><span className="block text-xs font-medium text-foam">Account</span><span className="block truncate text-[11px] text-dim">{user?.email}</span></span></Link>
        <button onClick={() => void logout()} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-mist hover:bg-flare/10 hover:text-[#ffb6a7]"><LogOut className="size-4" /> Log out</button>
      </div>
    </aside>

    <div className="lg:pl-64">
      <header className="sticky top-0 z-[700] flex h-[72px] items-center gap-4 border-b hairline bg-abyss/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <button onClick={() => setMenuOpen(true)} className="grid size-10 place-items-center rounded-xl border hairline lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button>
        <div className="lg:hidden"><Brand /></div>
        <div className="hidden min-w-0 sm:block"><p className="text-[10px] font-medium uppercase tracking-[.18em] text-cyan">{eyebrow}</p><h1 className="truncate text-lg font-semibold tracking-[-.02em]">{title}</h1></div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border hairline bg-foam/[0.035] px-3 py-2 text-xs text-mist md:flex"><MapPin className="size-3.5 text-cyan" /> Brickell, Miami</div>
          <div className="hidden text-right text-xs xl:block"><p className="text-foam">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p><p className="text-[10px] text-sev-none">Live systems online</p></div>
          <Link to="/alerts" className="relative grid size-10 place-items-center rounded-full border hairline bg-foam/[0.035]" aria-label="Notifications"><Bell className="size-[18px]" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-fire shadow-[0_0_8px_#ff8a3d]" /></Link>
          <Link to="/account" className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-electric to-cyan text-abyss" aria-label="Account"><User className="size-[18px]" /></Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1800px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">{children}</main>
    </div>

    {menuOpen && <div className="fixed inset-0 z-[1000] lg:hidden"><button className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /><aside className="relative flex h-full w-[min(86vw,320px)] flex-col border-r hairline bg-[#051126] p-5"><div className="flex items-center justify-between"><Brand /><button onClick={() => setMenuOpen(false)} className="grid size-10 place-items-center" aria-label="Close navigation"><X /></button></div><nav className="mt-8 space-y-1">{nav()}</nav><button onClick={() => void logout()} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-mist"><LogOut className="size-4" /> Log out</button></aside></div>}
    <nav className="fixed inset-x-0 bottom-0 z-[750] flex items-end justify-around border-t hairline bg-[#051126]/95 px-2 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">{nav(true).slice(0, 4)}<Link to="/account" className="flex min-w-14 flex-col items-center gap-1 text-[10px] text-mist"><User className="size-5" />Account</Link></nav>
  </div>;
}
