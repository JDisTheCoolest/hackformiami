# 4forces — website (`web/`)

Landing page for **4forces — Four Forces. One City.** An early-warning prototype for Miami covering water, air, land and fire.
The website introduces the product and routes people into the separate app (`app/`), where reports are filed and the
alert hardware is tested. It never writes to the backend.

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:5173 — proxies /api to http://localhost:8000 (the backend)
npm run build      # type-check + production build into web/dist (static files)
npm run lint
npm run preview    # serve web/dist locally
```

Node 20+ (tested with Node 24 on Apple Silicon / darwin-arm64).

## Configuration — one source of truth

| Variable | Used for | Default |
|---|---|---|
| `VITE_API_BASE` | Base URL for the read-only API calls | empty = same origin |
| `DEV_API_PROXY` | Dev-server proxy target for `/api` | `http://localhost:8000` |

Put overrides in **`.env.local` at the repository root** (`vite.config.ts` sets `envDir` to the root). Every **Go to the App** CTA uses the same-origin protected `/app/` route through `components/ui/app-link.tsx`.

## Deployment note

`backend/main.py` serves the production build from `web/dist/`. Run `npm run build` before starting the backend.

The build output is plain static HTML/CSS/JS, so the Pi needs no Node runtime if the build is done elsewhere.

## Live data (read-only)

`lib/live-data.tsx` polls the documented endpoints from `backend/API.md`:
`GET /api/health`, `/api/tide` (10 min), `/api/alerts/latest` (15 s), `/api/reports?hours=24` (30 s).
If the backend is unreachable, every consumer shows a labeled fallback. Nothing is invented:

| Where | Live when API is up | When offline |
|---|---|---|
| Hero status line | API + AI model status | "API not connected" |
| Miami map (Leaflet, Esri dark-gray basemap) | Real reports at their real coordinates, colored by severity; NOAA station | No report markers |
| Assistant (tide / alert questions) | NOAA tide via API, latest 4forces alert, with source + time | Demo answer, labeled |
| Phone preview | Tide + latest alert | Sample values from `backend/API.md`, labeled "Sample data" |

The assistant has no AI of its own (there is no Q&A endpoint). It never uploads photos; it points people to the app,
where `POST /api/reports` sends photos to Gemma 4. Voice uses the browser's Web Speech API (Chrome processes audio on
Google's servers), requested only after the mic button is pressed.

## Structure

```
web/
├── components/
│   ├── brand/      EyeMark (the "o" with eyes), Wordmark
│   ├── ui/         app-link (shared CTA), iphone-16-pro, live-status, reveal, news-video
│   ├── visuals/    ParticleWave, ForceVisuals (gusts/land/fire), ScanView, CityMap (Leaflet), OrbCanvas
│   ├── sections/   Nav, Hero + HeroScenes, LiveCity (simulated replay), Community (chat concept), SignalChain, ForceStage, MiamiFocus, HowItWorks, Assistant, AppShowcase, Hardware, Closing
│   └── mobile/     PhoneScreens (visual preview of the app — not app code)
├── lib/            config, api, live-data, assistant, hooks, utils
├── types/          API types mirroring backend/API.md
├── public/assets/images/   team-supplied photos
└── src/            main.tsx, App.tsx, styles/globals.css (design tokens)
```

Path alias `@/` → `web/`.

## Hero scenes

`components/sections/HeroScenes.tsx` cycles the hero background **water → air → land → fire**.
Water is the particle wave, air is the storm-skyline photo with wind streaks, land is the street photo with terrain
contours, and fire is the heat shader. Scenes dissolve with a slow blur and scale and photos drift (Ken Burns).
It pauses off-screen, has a pause button, and does not auto-advance under `prefers-reduced-motion`.
Only the visible scene's canvas or shader runs. Durations live in `SCENES`.

## Four Forces "AI scan" panels

`components/visuals/ScanView.tsx` runs the Four Forces panels. A scan line sweeps a team photo, and glitch tiles
(pixelated, iridescent) break the image up along it. Detected regions then lock into crisp windows with brackets,
and Siri-style glass capsules show what was spotted. A reading capsule counts up to a confidence score. The panel
auto-advances through the forces until a visitor picks a tab. Detections and readings live in
`components/sections/ForceStage.tsx`. They are **example readings, labeled "not live"**: they mirror the backend's
output (hazard, severity, confidence) but are not produced by the model.

## Live city replay & community thread

- `LiveCity.tsx`: a real Leaflet map that replays a **simulated** king-tide hour (labeled on screen). Flooding spreads at
  real Miami tidal-flooding hot spots, reports and street-camera pins appear, alerts fire, and a "You" pin shows where a
  visitor's report fits. It has play/pause and a scrubber; the scenario data is the `EVENTS`/`ZONES` arrays.
- `Community.tsx`: concept for neighborhood threads (labeled "planned"). It includes a glass speech-bubble icon that fills
  with glossy spheres per unread message, emoji reactions that launch upward, and a composer whose messages stay in the browser.

## Motion & performance

All animation is Canvas 2D, one small raw-WebGL shader (fire), SVG and CSS. There is no three.js or animation library.
Maps use Leaflet (pure JS) with Esri's keyless World Dark Gray Canvas tiles (attribution shown on the map).
Don't put a CSS `filter` on an ancestor of a Leaflet map: it breaks Chromium compositing (the map and its container go blank).
Every canvas loop pauses off-screen and in hidden tabs, caps DPR at 2, and draws one still frame under
`prefers-reduced-motion`. The fire shader renders at half resolution and falls back to a CSS gradient without WebGL.

## ARM64

Verified: install, lint, type-check and production build run natively on darwin-arm64 (Apple Silicon).
The only native build deps are rolldown, lightningcss and Tailwind's oxide; `package-lock.json` includes their
`linux-arm64-gnu` builds. A linux/arm64 build (e.g. on the Raspberry Pi) has **not** been run yet.

## Credits & licensing

- `components/ui/iphone-16-pro.tsx`: adapted from "iphone-16-pro" by designali-in on 21st.dev (MIT).
- Fire shader: original code. The 21st.dev "shader-fire" component was studied as a reference only; it has no license, so none of its code is used.
- Photos in `public/assets/images/` were supplied by the team. `miami-storm-skyline.jpg` carries a Getty Images
  watermark, and the others are likely news photos. **Confirm usage rights before public release.**
- Font: Inter Tight only (self-hosted via Fontsource, SIL OFL) — the same face as the wordmark.
- News videos (Miami section): WPLG Local 10 and CNN clips, embedded click-to-play from YouTube (`components/ui/news-video.tsx`).
  Only the thumbnail loads until someone presses play.

## Design references

| Reference | What we took |
|---|---|
| Wave artwork (team image) | Hero: original canvas wave whose crest is drifting particles plus a few connected "measurement" nodes |
| Koi Fish hero | Sans + italic-serif headline pairing; calm water motion |
| Shopify Editions | One giant word per force on a single stage, instead of four cards |
| Honk | Phone that cycles real screens (overview → alert → report) |
| Dayrise | Phone UI tinted by state (alert screen turns red-night) |
| Codex × Vidu | Scanning sweep over the Miami map |
| AI Vision Glitch Motion | Four Forces panels: segmentation-style glitch tiles, crosshairs, label tags, locked regions |
| macOS Search → Siri, Voice Glow | Orb with idle/focused/listening/processing/responding/error states; composer glow colored by the force being asked about |
| Animated vector characters | The "o" in 4forces: a ring with two eyes that follow the pointer and blink |
| 21st.dev fire shader | Idea of a domain-warped fBm heat field in raw WebGL (code written from scratch) |
