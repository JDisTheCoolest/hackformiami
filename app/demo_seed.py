#!/usr/bin/env python3
"""Seed the demo with realistic Miami flood reports through the public API.

  python3 app/demo_seed.py [--base http://localhost:8000] [--reset] [--token T]

Two reports near Brickell Bay Dr (different reporters, so no alert yet; send the 3rd live
on stage) plus single reports spread across the city. Street coordinates come from
OpenStreetMap Nominatim; each has a hard-coded land fallback so a pin never lands in the water.
"""
import argparse, json, math, mimetypes, os, sys, time, uuid
import urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = [ROOT / "web/public/assets/images/flood-submerged-car.jpg",
          ROOT / "web/public/assets/images/flooded-residential-street.jpg"]
PHOTOS += sorted(p for p in (Path(__file__).parent / "demo_photos").glob("*")
                 if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"))

# (query, fallback lat/lng, area, text)
REPORTS = [
    ("1200 Brickell Bay Dr, Miami, FL", (25.7660, -80.1880), "Brickell Bay Dr",
     "Water up to the car doors on Brickell Bay Dr, cars are stalling."),
    ("1000 Brickell Bay Dr, Miami, FL", (25.7625, -80.1875), "Brickell Bay Dr",
     "Street fully flooded here, water over the tires, can't get through."),
    ("West Ave & 17th St, Miami Beach, FL", (25.7905, -80.1440), "West Ave, Miami Beach",
     "King tide pushing water up through the drains on West Ave."),
    ("Purdy Ave & 20th St, Miami Beach, FL", (25.7955, -80.1425), "Sunset Harbour",
     "Sunset Harbour is flooding, water covering the sidewalk and parked cars."),
    ("SW 8th St & SW 12th Ave, Miami, FL", (25.7655, -80.2175), "SW 8th St",
     "Standing water on SW 8th St, ankle deep along the curb."),
    ("NE 75th St & NE 2nd Ave, Miami, FL", (25.8447, -80.1935), "Little River",
     "Water pooling at the intersection in Little River, drains are backed up."),
    ("NE 29th St & Biscayne Blvd, Miami, FL", (25.8014, -80.1913), "Edgewater",
     "Edgewater street starting to flood, water creeping onto the road."),
]


def dist_m(a, b):
    dy = (b[0] - a[0]) * 111_000
    dx = (b[1] - a[1]) * 111_000 * math.cos(math.radians(a[0]))
    return math.hypot(dx, dy)


def geocode(query, fallback):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": query, "format": "json", "limit": 1})
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "4forces-demo-seed/1.0 (hackathon demo)"})
        hit = json.load(urllib.request.urlopen(req, timeout=10))[0]
        pt = (float(hit["lat"]), float(hit["lon"]))
        if dist_m(pt, fallback) < 1500:  # guards against a wrong match
            return pt, "nominatim"
    except Exception:
        pass
    return fallback, "fallback"


def call(base, path, token, data=None, headers=None):
    h = dict(headers or {})
    if token:
        h["X-Admin-Token"] = token
    req = urllib.request.Request(base + path, data=data, headers=h, method="POST" if data is not None or path == "/api/reset" else "GET")
    return json.load(urllib.request.urlopen(req, timeout=60))


def multipart(fields, photo):
    b = uuid.uuid4().hex
    out = b""
    for k, v in fields.items():
        out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    ctype = mimetypes.guess_type(photo.name)[0] or "image/jpeg"
    out += f'--{b}\r\nContent-Disposition: form-data; name="photo"; filename="{photo.name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode()
    out += photo.read_bytes() + f"\r\n--{b}--\r\n".encode()
    return out, {"Content-Type": f"multipart/form-data; boundary={b}"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--reset", action="store_true", help="POST /api/reset first (deletes ALL reports and alerts)")
    ap.add_argument("--token", default=os.getenv("ADMIN_TOKEN", ""))
    a = ap.parse_args()
    base = a.base.rstrip("/")
    photos = [p for p in PHOTOS if p.exists()]
    if not photos:
        sys.exit("no photos found")

    if a.reset:
        call(base, "/api/reset", a.token, data=b"")
        print("reset done")

    ids = []
    for i, (query, fallback, area, text) in enumerate(REPORTS):
        (lat, lng), how = geocode(query, fallback)
        time.sleep(1.1)
        photo = photos[i % len(photos)]
        body, hdr = multipart({"lat": lat, "lng": lng, "text": text, "area": area,
                               "reporter_id": f"demo_{i + 1}", "source": "neighbor"}, photo)
        r = call(base, "/api/reports", a.token, data=body, headers=hdr)
        ids.append(r["report"]["id"])
        print(f"sent {ids[-1]} {area} ({lat:.4f}, {lng:.4f}, {how}) photo={photo.name}")
        if r.get("alert"):
            print("  !! this report triggered an alert")

    print("waiting for analysis...")
    done, deadline = {}, time.time() + 180
    while len(done) < len(ids) and time.time() < deadline:
        time.sleep(3)
        for rep in call(base, "/api/reports?hours=24", a.token):
            if rep["id"] in ids and rep["id"] not in done and rep.get("status") != "analyzing":
                done[rep["id"]] = rep
                an = rep.get("analysis") or {}
                print(f"  {rep['id']} {rep.get('area', ''):24} {rep.get('status')}: {an.get('type')} / {an.get('severity')}"
                      f" depth={an.get('depth_in')} conf={an.get('confidence')}")
    if len(done) < len(ids):
        print(f"{len(ids) - len(done)} report(s) still analyzing after 180 s")
    print("alert now:", (call(base, "/api/alerts/latest", a.token).get("alert") or {}).get("id"))


if __name__ == "__main__":
    main()
