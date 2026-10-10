"""
Core logic for Miami Alert Hub (standard library only, easy to test).

(All AI code lives in ai.py.)
- Store: reports + alerts saved to data/db.json
- maybe_create_alert: "enough reports close together" -> alert
- get_tide: next high tide from NOAA (Virginia Key) + king tide window
"""
import json
import math
import threading
import time
import urllib.parse
import urllib.request
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

MIAMI_TZ = ZoneInfo("America/New_York")

SEVERITIES = ["none", "low", "moderate", "severe"]


# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------
def distance_m(lat1, lng1, lat2, lng2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def now_iso() -> str:
    return datetime.now(MIAMI_TZ).isoformat(timespec="seconds")


def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s)


# ---------------------------------------------------------------------------
# Storage (one JSON file, enough for a hackathon and survives restarts on the Pi)
# ---------------------------------------------------------------------------
class Store:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        self.data = {"reports": [], "alerts": []}
        if path.exists():
            try:
                self.data = json.loads(path.read_text())
            except json.JSONDecodeError:
                pass

    def save(self):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=2, ensure_ascii=False))
        tmp.replace(self.path)

    def add_report(self, report: dict):
        with self.lock:
            self.data["reports"].append(report)
            self.save()

    def update(self, report: dict, **fields):
        with self.lock:
            report.update(fields)
            self.save()

    def add_alert(self, alert: dict):
        with self.lock:
            self.data["alerts"].append(alert)
            self.save()

    def reset(self):
        with self.lock:
            self.data = {"reports": [], "alerts": []}
            self.save()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Alert rule: N qualifying reports of the same type within R meters and T minutes
# ---------------------------------------------------------------------------
TYPE_LABELS = {
    "flood": {"en": "Flood", "es": "inundación", "ht": "inondasyon"},
    "fire": {"en": "Fire", "es": "incendio", "ht": "dife"},
    "downed_power_line": {"en": "Downed power line", "es": "cables eléctricos caídos", "ht": "fil elektrik tonbe"},
    "downed_tree": {"en": "Fallen tree", "es": "árbol caído", "ht": "pyebwa tonbe"},
    "storm_damage": {"en": "Storm damage", "es": "daños por tormenta", "ht": "domaj tanpèt"},
    "other": {"en": "Emergency", "es": "emergencia", "ht": "ijans"},
}


def qualifies(report: dict, min_conf: float) -> bool:
    a = report["analysis"]
    return (a["is_disaster"] and a["severity"] in ("moderate", "severe")
            and a["confidence"] >= min_conf)


def build_alert_message(atype: str, count: int, area: str, top_report: dict) -> dict:
    lab = TYPE_LABELS.get(atype, TYPE_LABELS["other"])
    where_en = f" near {area}" if area else " nearby"
    where_es = f" cerca de {area}" if area else " cerca"
    where_ht = f" toupre {area}" if area else " toupre"
    s = top_report["analysis"]["summary"]
    return {
        "en": f"{lab['en']} alert: {count} neighbors reported it{where_en}. {s['en']} Avoid the area.".strip(),
        "es": f"Alerta de {lab['es']}: {count} vecinos lo reportaron{where_es}. {s['es']} Evite la zona.".strip(),
        "ht": f"Alèt {lab['ht']}: {count} vwazen rapòte sa{where_ht}. {s['ht']} Evite zòn nan.".strip(),
    }


def maybe_create_alert(store: Store, report: dict, threshold: int, radius_m: float,
                       window_min: int, min_conf: float):
    """Return a new alert dict if this report pushes its area over the threshold, else None."""
    if not qualifies(report, min_conf):
        return None
    atype = report["analysis"]["type"]
    cutoff = datetime.now(MIAMI_TZ) - timedelta(minutes=window_min)

    def recent(item):
        return parse_iso(item["created_at"]) >= cutoff

    def near(item):
        return distance_m(report["lat"], report["lng"], item["lat"], item["lng"]) <= radius_m

    with store.lock:
        reports = list(store.data["reports"])
        alerts = list(store.data["alerts"])

    cluster = [r for r in reports
               if r.get("analysis") and r["analysis"]["type"] == atype and recent(r) and near(r) and qualifies(r, min_conf)]
    # independent sources: one camera (or app install) sending many photos counts once;
    # reports without reporter_id each count on their own
    sources = {r.get("reporter_id") or r["id"] for r in cluster if r.get("source") != "camera"}
    if len(sources) < threshold:
        return None
    # don't fire twice for the same area/type within the window
    if any(a["type"] == atype and not a.get("test") and recent(a) and near(a) for a in alerts):
        return None

    top = max(cluster, key=lambda r: (SEVERITIES.index(r["analysis"]["severity"]), r["analysis"]["confidence"]))
    area = next((r["area"] for r in reversed(cluster) if r.get("area")), "")
    alert = {
        "id": new_id("a"),
        "type": atype,
        "level": top["analysis"]["severity"],
        "count": len(sources),
        "lat": round(sum(r["lat"] for r in cluster) / len(cluster), 6),
        "lng": round(sum(r["lng"] for r in cluster) / len(cluster), 6),
        "area": area,
        "message": build_alert_message(atype, len(sources), area, top),
        "report_ids": [r["id"] for r in cluster],
        "created_at": now_iso(),
        "test": False,
    }
    store.add_alert(alert)
    return alert


def make_test_alert(store: Store, atype: str = "flood", area: str = "") -> dict:
    atype = atype if atype in TYPE_LABELS else "flood"
    lab = TYPE_LABELS[atype]
    alert = {
        "id": new_id("a"), "type": atype, "level": "severe", "count": 0,
        "lat": 25.7617, "lng": -80.1918, "area": area,
        "message": {
            "en": f"Test alert. {lab['en']} reported{' near ' + area if area else ''}. This is only a test.",
            "es": f"Alerta de prueba: {lab['es']}{' cerca de ' + area if area else ''}. Esto es solo una prueba.",
            "ht": f"Alèt tès: {lab['ht']}{' toupre ' + area if area else ''}. Se jis yon tès.",
        },
        "report_ids": [], "created_at": now_iso(), "test": True,
    }
    store.add_alert(alert)
    return alert


# ---------------------------------------------------------------------------
# Tides (NOAA CO-OPS, Virginia Key 8723214)
# ---------------------------------------------------------------------------
# 2026 king tide windows from the City of Miami Beach calendar (mbrisingabove.com)
KING_TIDE_WINDOWS = [
    (date(2026, 9, 26), date(2026, 9, 30)),
    (date(2026, 10, 7), date(2026, 10, 13)),
    (date(2026, 10, 24), date(2026, 10, 30)),
    (date(2026, 11, 6), date(2026, 11, 9)),
    (date(2026, 11, 23), date(2026, 11, 26)),
]
NOAA_URL = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
_tide_cache = {"at": 0.0, "data": None}


def in_king_tide_window(d: date) -> bool:
    return any(a <= d <= b for a, b in KING_TIDE_WINDOWS)


def fetch_noaa_hilo(station: str, now: datetime) -> list:
    params = {
        "begin_date": now.strftime("%Y%m%d"), "range": "48", "station": station,
        "product": "predictions", "datum": "MLLW", "interval": "hilo",
        "units": "english", "time_zone": "lst_ldt", "format": "json",
        "application": "miami_alert_hub",
    }
    url = NOAA_URL + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=10) as resp:
        payload = json.loads(resp.read().decode())
    out = []
    for p in payload.get("predictions", []):
        t = datetime.strptime(p["t"], "%Y-%m-%d %H:%M").replace(tzinfo=MIAMI_TZ)
        out.append({"time": t, "height_ft": round(float(p["v"]), 2), "type": p["type"]})
    return out


def summarize_tide(preds: list, now: datetime, station: str) -> dict:
    highs = [p for p in preds if p["type"] == "H"]
    nxt = next((p for p in highs if p["time"] > now), None)
    nearest_gap_h = min((abs((p["time"] - now).total_seconds()) / 3600 for p in highs), default=99)
    window = in_king_tide_window(now.date())
    if window and nearest_gap_h <= 2:
        risk = "high"
    elif window:
        risk = "elevated"
    else:
        risk = "low"
    t_str = nxt["time"].strftime("%-I:%M %p") if nxt else ""
    alert = {
        "high": {"en": f"King tide: high water around {t_str}. Low streets may flood. Do not drive through water.",
                 "es": f"Marea real: agua alta alrededor de las {t_str}. Las calles bajas pueden inundarse. No maneje por el agua.",
                 "ht": f"Gwo mare: dlo ap monte vè {t_str}. Lari ki ba yo ka inonde. Pa kondwi nan dlo."},
        "elevated": {"en": f"King tide week. Next high tide at {t_str}. Watch low-lying streets.",
                     "es": f"Semana de marea real. Próxima marea alta a las {t_str}. Atención a las calles bajas.",
                     "ht": f"Semèn gwo mare. Pwochen mare wo a {t_str}. Fè atansyon ak lari ki ba yo."},
        "low": {"en": f"Next high tide at {t_str}.", "es": f"Próxima marea alta a las {t_str}.",
                "ht": f"Pwochen mare wo a {t_str}."},
    }[risk]
    return {
        "station": "Virginia Key, FL", "station_id": station,
        "next_high": {"time": nxt["time"].isoformat(), "height_ft": nxt["height_ft"]} if nxt else None,
        "upcoming": [{"time": p["time"].isoformat(), "height_ft": p["height_ft"], "type": p["type"]}
                     for p in preds if p["time"] > now][:4],
        "king_tide_window": window,
        "risk": risk,
        "alert": alert,
    }


def get_tide(station: str = "8723214", max_age_s: int = 600) -> dict:
    """Cached NOAA tide summary. If NOAA fails, return the last good data marked stale."""
    now = datetime.now(MIAMI_TZ)
    cached = _tide_cache["data"]
    if cached and time.time() - _tide_cache["at"] < max_age_s:
        return {**cached, "stale": False}
    try:
        data = summarize_tide(fetch_noaa_hilo(station, now), now, station)
        data["updated_at"] = now.isoformat(timespec="seconds")
        _tide_cache.update(at=time.time(), data=data)
        return {**data, "stale": False}
    except Exception as exc:  # network down, NOAA down...
        if cached:
            return {**cached, "stale": True}
        return {"error": f"tide data unavailable: {exc}", "stale": True,
                "king_tide_window": in_king_tide_window(now.date())}
