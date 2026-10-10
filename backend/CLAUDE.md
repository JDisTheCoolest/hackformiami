# Project brief for Claude Code (Sanzhar's part: backend/ + app/)

Hack for Humanity: Miami, Oct 10 2026. Build ends 3:30 PM ET, submission 3:45 PM.
Track 01 "Four Forces, One City" (main force: water; other hazards allowed).

## The idea
Neighbors report emergencies (flood, fire, downed power lines/trees, storm damage)
from a mobile web app: photo, text, voice-to-text, or a mix. Gemma 4 analyzes each
report (type, severity, flood depth, can cars pass, confidence). When 3+ confident
reports of the same type arrive within 1 km and 60 min, the backend creates an alert.
Raspberry Pi speakers poll the backend and announce the alert out loud in English,
Spanish and Haitian Creole. A live map shows reports; a banner shows NOAA tide risk
(today is the October king tide peak in Miami).

## Ownership — only edit backend/ and app/
- Sanzhar: backend/ and app/ (the web app)
- Magzhan: website/ (landing page, served at /)
- JD: hardware (Pi speaker), deploy/, manager/ — do not touch deploy/ or manager/
- Root README.md and LICENSE belong to the team; ask before changing them.

## Stack and contract
- backend: FastAPI (main.py), pure-stdlib logic in core.py, JSON file storage in backend/data/
- AI: Gemma 4 via Gemini API, `google-genai` SDK, model from env GEMMA_MODEL
  (gemma-4-26b-a4b-it default, retried once, then gemma-4-31b-it). Free tier.
- No GEMINI_API_KEY -> MOCK mode (fake analysis) so web and speaker work without AI.
- API contract: backend/API.md — keep it in sync when endpoints change.
- Server also serves ../website at / and ../app at /app (one URL for judges).

## The app (app/) — to build
- Plain HTML + JS in app/index.html, no build step, Leaflet + OpenStreetMap. Mobile first.
- Map of GET /api/reports colored by severity (none/low/moderate/severe = green/yellow/orange/red);
  "Unconfirmed" badge when needs_confirmation is true.
- Report form: photo (input accept="image/*" capture="environment"), text, voice button
  (Web Speech API -> text), geolocation, optional area name -> POST /api/reports (multipart).
  Show spinner (Gemma takes ~5-15 s) and handle 400/413/502 errors.
- Red alert banner from GET /api/alerts/latest, tide banner from GET /api/tide, EN/ES/HT switch.
- Poll every 5 s. manifest.json + apple-mobile-web-app meta tags for "Add to Home Screen".
- Always show: "Never walk or drive through flood water."

## Rules
- Hackathon: all code is written today; list AI tools used in the README.
- NEVER commit .env or any API key (Google keys start with "AIza"). backend/.gitignore covers .env.
- Repo is private now and will be made public before submission, with MIT license.
- Prefer working end-to-end over extra features. Code freeze 3:00 PM.

## Run
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # add GEMINI_API_KEY
uvicorn main:app --reload --port 8000   # http://localhost:8000/docs
```
