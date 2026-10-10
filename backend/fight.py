"""Local camera fight classifier. Treat results as tentative, not verified incidents."""
import json
from ai import _client, GEMMA_MODEL, MOCK

def detect_fight(image: bytes, mime: str) -> bool:
    if MOCK or _client is None:
        return False
    from google.genai import types
    prompt = """Analyze this camera frame for an ongoing physical fight between people.
Return ONLY JSON: {"fight":true} or {"fight":false}.
True only if the frame CLEARLY shows physical violence between people (punching, kicking,
grappling aggressively). Do not flag conversations, dancing, sports, crowds, arguments,
or uncertain/ambiguous scenes. Never infer an incident from clothing or identities."""
    response = _client.models.generate_content(
        model=GEMMA_MODEL,
        contents=[types.Part.from_bytes(data=image,mime_type=mime),prompt],
        config=types.GenerateContentConfig(temperature=0))
    raw=(response.text or "").strip()
    start,end=raw.find("{"),raw.rfind("}")
    if start<0 or end<start:
        return False
    return json.loads(raw[start:end+1]).get("fight") is True
