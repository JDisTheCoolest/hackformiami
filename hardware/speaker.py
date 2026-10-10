"""
Miami Alert Hub - speaker for Raspberry Pi.

Polls the server; when a new alert appears it plays a siren and reads the
alert out loud (English, then Spanish, then Haitian Creole if available).
LEDs: green = all clear, yellow = king tide risk, red = active alert.

Setup on the Pi:
    sudo apt install -y espeak-ng alsa-utils
    pip install requests gpiozero      (gpiozero is optional)
    SERVER_URL=http://localhost:8000 python3 speaker.py
Check voices:  espeak-ng --voices | grep -E " (en|es|ht)"
"""
import os
import base64
import io
import wave
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000").rstrip("/")
POLL_SECONDS = float(os.getenv("POLL_SECONDS", "5"))
LANGS = os.getenv("SPEAK_LANGS", "en,es,ht").split(",")      # drop "ht" if espeak has no Creole voice
VOICES = {"en": "en-us", "es": "es-419", "ht": "ht"}
SIREN_WAV = Path(__file__).with_name("siren.wav")              # optional: put a siren sound here
TTS_VOICE = os.getenv("TTS_VOICE", "Despina")
TTS_MODEL = os.getenv("TTS_MODEL", "gemini-2.5-flash-preview-tts")
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "edge").lower()
EDGE_VOICES = {"en":"en-US-JennyNeural","es":"es-US-PalomaNeural","ht":"fr-FR-DeniseNeural"}
EDGE_VOICE = os.getenv("EDGE_VOICE", "en-US-JennyNeural")
RED_MINUTES = 30                                               # keep red LED on this long after an alert

leds = None
try:
    from gpiozero import LED
    leds = {"green": LED(int(os.getenv("LED_GREEN", "17"))),
            "yellow": LED(int(os.getenv("LED_YELLOW", "27"))),
            "red": LED(int(os.getenv("LED_RED", "22")))}
except Exception:
    print("gpiozero/LEDs not available - running without LEDs")


def set_led(color: str):
    if not leds:
        return
    for name, led in leds.items():
        led.on() if name == color else led.off()


def output_audio(wav: bytes):
    """Send WAV audio to the user's default PipeWire/PulseAudio output."""
    if not shutil.which("paplay"):
        raise RuntimeError("paplay missing; install pulseaudio-utils")
    result = subprocess.run(["paplay", "--raw", "--format=s16le", "--rate=22050", "--channels=1"], input=wav, capture_output=True)
    if result.returncode:
        raise RuntimeError("Default audio playback failed: " + result.stderr.decode(errors="replace")[:300])


def siren():
    if SIREN_WAV.exists() and shutil.which("paplay"):
        result = subprocess.run(["paplay", str(SIREN_WAV)], capture_output=True)
        if result.returncode:
            raise RuntimeError("Siren playback failed: " + result.stderr.decode(errors="replace")[:300])
    else:
        say("Alert! Alert!", "en")


def _gemini_speech(text: str) -> bytes:
    """Render Gemini Despina's mono 24 kHz PCM response into a WAV."""
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError("GEMINI_API_KEY missing for Gemini TTS")
    url = "https://generativelanguage.googleapis.com/v1beta/models/" + TTS_MODEL + ":generateContent"
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": TTS_VOICE}}}
        }
    }
    response = requests.post(url, headers={"x-goog-api-key": key}, json=payload, timeout=20)
    response.raise_for_status()
    data = response.json()
    parts = data["candidates"][0]["content"]["parts"]
    inline = next(p["inlineData"] for p in parts if "inlineData" in p)
    pcm = base64.b64decode(inline["data"])
    if not pcm:
        raise RuntimeError("Gemini TTS returned empty audio")
    stream = io.BytesIO()
    with wave.open(stream, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(24000)
        output.writeframes(pcm)
    return stream.getvalue()


def _edge_speech(text: str, lang: str) -> bytes:
    """Natural neural TTS using an online speech service; requires internet."""
    import tempfile
    voice = EDGE_VOICE if lang == "en" else EDGE_VOICES.get(lang, EDGE_VOICE)
    with tempfile.TemporaryDirectory(prefix="4forces-tts-") as folder:
        mp3 = str(Path(folder) / "speech.mp3")
        tool = "/opt/hackformiami/hardware/voice-venv/bin/edge-tts"
        if not Path(tool).is_file():
            raise RuntimeError("Natural voice not installed; run install-hardware.sh")
        result = subprocess.run([tool, "--voice", voice, "--text", text, "--write-media", mp3],
                                capture_output=True, timeout=25)
        if result.returncode:
            raise RuntimeError("Neural TTS failed: " + result.stderr.decode(errors="replace")[:160])
        if not shutil.which("ffmpeg"):
            raise RuntimeError("ffmpeg is needed to decode neural speech")
        pcm = subprocess.run(["ffmpeg","-v","error","-i",mp3,"-f","wav","-"],
                             capture_output=True, timeout=15)
        if pcm.returncode or not pcm.stdout:
            raise RuntimeError("Neural speech decoding failed")
        return pcm.stdout


def _local_speech(text: str, lang: str) -> bytes:
    if not shutil.which("espeak-ng"):
        raise RuntimeError("espeak-ng not installed")
    wav = subprocess.run(["espeak-ng", "--stdout", "-v", VOICES.get(lang, lang),
                          "-s", "150", text], capture_output=True)
    if wav.returncode:
        raise RuntimeError("Local speech synthesis failed: " + wav.stderr.decode(errors="replace")[:200])
    return wav.stdout


def say(text: str, lang: str):
    print(f"[{lang}] {text} | TTS provider: {TTS_PROVIDER}", flush=True)
    try:
        if TTS_PROVIDER == "edge":
            wav = _edge_speech(text, lang)
        elif TTS_PROVIDER == "gemini":
            wav = _gemini_speech(text)
        else:
            wav = _local_speech(text, lang)
    except Exception as exc:
        print("Natural speech unavailable, falling back to eSpeak:", str(exc)[:200], flush=True)
        wav = _local_speech(text, lang)
    if not shutil.which("paplay"):
        raise RuntimeError("paplay unavailable; install pulseaudio-utils")
    result = subprocess.run(["paplay"], input=wav, capture_output=True)
    if result.returncode:
        raise RuntimeError("Default audio output failed: " + result.stderr.decode(errors="replace")[:300])


def play(alert: dict):
    set_led("red")
    siren()
    say("Attention. Four Forces safety alert.", "en")
    for lang in LANGS:
        text = alert.get("message", {}).get(lang.strip())
        if text:
            say(text, lang.strip())
            time.sleep(0.5)


def minutes_since(iso: str) -> float:
    try:
        then = datetime.fromisoformat(iso)
        return (datetime.now(timezone.utc) - then).total_seconds() / 60
    except Exception:
        return 1e9


def main():
    state_file = Path(os.getenv("SPEAKER_STATE", str(Path.home() / ".local/state/4forces/last_alert_id")))
    try: last_id = state_file.read_text().strip() or None
    except OSError: last_id = None
    first = True
    last_tide_check, tide_risk = 0.0, "low"
    print(f"Listening to {SERVER_URL} ...")
    while True:
        try:
            alert = requests.get(f"{SERVER_URL}/api/alerts/latest", timeout=5).json().get("alert")
            if time.time() - last_tide_check > 60:
                try: tide_risk = requests.get(f"{SERVER_URL}/api/tide", timeout=5).json().get("risk") or "low"
                except Exception as e: print("Tide request failed; alerts continue:",e,flush=True)
                last_tide_check = time.time()

            if alert and alert["id"] != last_id:
                if not first:                 # don't replay an old alert when the speaker boots
                    play(alert)
                last_id = alert["id"]
                state_file.parent.mkdir(parents=True, exist_ok=True)
                state_file.write_text(last_id)

            if alert and minutes_since(alert["created_at"]) < RED_MINUTES:
                set_led("red")
            elif tide_risk in ("high", "elevated"):
                set_led("yellow")
            else:
                set_led("green")
            first = False
        except Exception as exc:
            print("server not reachable:", exc)
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    if "--test" in __import__("sys").argv:
        say("Alert! Alert! Possible fighting has been detected in the monitored area. Stop any physical confrontation immediately. Keep a safe distance. Do not approach or join the fight. Move away calmly and give others space. If someone is injured or in immediate danger, call emergency services or notify a responsible staff member. This is a test of the Four Forces fight alert system.", "en")
    else:
        main()
