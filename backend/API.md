# API contract

Base URL: `http://localhost:8000` while developing, the tunnel URL on the Pi.
Interactive docs: `/docs`. All responses are JSON.

## POST /api/reports — a neighbor sends a report
`multipart/form-data`. Send a photo, a text, or both.

| field | required | example |
|---|---|---|
| `lat` | yes | `25.7650` |
| `lng` | yes | `-80.1880` |
| `photo` | one of photo/text | image file |
| `text` | one of photo/text | `"Water up to the car doors on Brickell Bay Dr"` |
| `area` | no | `"Brickell Bay Dr"` (street or neighborhood, used in the alert) |

Voice: turn speech into text in the browser (Web Speech API) and send it as `text`.

Returns **immediately** (~10 ms) with `status: "analyzing"` and `analysis: null`. Gemma runs in the
background (usually 2-20 s, up to ~60 s if the first model is slow). If the server restarts mid-analysis, it re-runs those reports on startup. Poll `GET /api/reports` until the
report's `status` is `done` or `failed`. The alert check runs after the analysis, so the top-level
`alert` is always `null` here; read alerts from `/api/alerts/latest`.

Response (shown after analysis finished; right after POST `status` is `"analyzing"` and `analysis` is `null`):
```json
{
  "report": {
    "id": "r_1a2b3c4d",
    "lat": 25.765, "lng": -80.188,
    "area": "Brickell Bay Dr",
    "text": "",
    "photo_url": "/photos/r_1a2b3c4d.jpg",
    "created_at": "2026-10-10T11:40:00-04:00",
    "mock": false,
    "status": "done",
    "analysis": {
      "is_disaster": true,
      "type": "flood",
      "severity": "severe",
      "depth_in": 10,
      "car_passable": false,
      "hazards": ["floating debris"],
      "reference_object": "tire",
      "confidence": 0.9,
      "model": "gemma-4-26b-a4b-it",
      "needs_confirmation": false,
      "reasoning": "Water covers the wheel rims.",
      "summary": { "en": "...", "es": "...", "ht": "..." }
    }
  },
  "alert": null
}
```
`alert` is filled when this report triggered a new alert (see below).

- `type`: `flood` | `fire` | `downed_power_line` | `downed_tree` | `storm_damage` | `other` | `none`
- `severity`: `none` | `low` | `moderate` | `severe` → map colors: green / yellow / orange / red
- `needs_confirmation: true` → show "Unconfirmed" badge (confidence below 0.6)
- `status`: `analyzing` (show a gray "analyzing..." pin) | `done` (colored pin) | `failed` (AI failed after
  all retries; `analysis` is `null`, `error` has the reason; show "try again"). `analysis` is `null` unless `done`.
- `analysis.model`: which model answered. Order: `GEMMA_MODEL` (`gemma-4-26b-a4b-it`) twice, then `FALLBACK_MODEL`
  (`gemma-4-31b-it`), then optional non-Gemma `FLASH_MODEL` (empty by default = Gemma 4 only).
  Photos are shrunk to max 1024 px before sending; thinking is set to `minimal`; each attempt times out after `MODEL_TIMEOUT_S` (20).
- `photo_url` can be `null` for text-only reports
- Errors: `400` (no photo and no text, not an image), `413` (photo > 10 MB). AI failures no longer return 502: the report gets `status: "failed"`.

## GET /api/reports?hours=24 — all reports for the map (newest first)
Array of `report` objects, including `analyzing` and `failed` ones (check `status`).

## GET /api/alerts/latest — for the speaker (poll every 5 s)
```json
{ "alert": {
    "id": "a_9f8e7d6c",
    "type": "flood",
    "level": "severe",
    "count": 3,
    "lat": 25.7655, "lng": -80.1885,
    "area": "Brickell Bay Dr",
    "message": { "en": "Flood alert: 3 neighbors reported it near Brickell Bay Dr. ...",
                 "es": "Alerta de inundación: ...",
                 "ht": "Alèt inondasyon: ..." },
    "report_ids": ["r_...", "r_...", "r_..."],
    "created_at": "2026-10-10T11:45:00-04:00",
    "test": false
} }
```
`{ "alert": null }` when there are no alerts. Play only when `id` changes.

## GET /api/alerts — all alerts (newest first)

## Alert rule
An alert fires when **3 reports** of the same `type`, with severity `moderate`/`severe`
and confidence ≥ 0.5, arrive within **1 km** and **60 minutes**. Only one alert per area/type per window.
Change with env vars `ALERT_THRESHOLD`, `ALERT_RADIUS_M`, `ALERT_WINDOW_MIN`, `MIN_CONFIDENCE`.

## GET /api/tide — banner
```json
{
  "station": "Virginia Key, FL",
  "next_high": { "time": "2026-10-10T21:33:00-04:00", "height_ft": 2.79 },
  "upcoming": [ { "time": "...", "height_ft": 0.56, "type": "L" } ],
  "king_tide_window": true,
  "risk": "elevated",
  "alert": { "en": "...", "es": "...", "ht": "..." },
  "updated_at": "2026-10-10T11:30:00-04:00",
  "stale": false
}
```
`risk`: `low` | `elevated` | `high`. If `stale: true`, show "updated at ...".

## Demo helpers (header `X-Admin-Token` if ADMIN_TOKEN is set)
- `POST /api/alerts/test?type=flood&area=Wynwood` — fire a test alert (speaker backup)
- `POST /api/reset` — clear all reports and alerts before the demo

## GET /api/health — `{ "ok": true, "mock": false, "model": "gemma-4-26b-a4b-it", ... }`
