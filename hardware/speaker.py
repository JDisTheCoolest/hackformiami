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


def say(text: str, lang: str):
    print(f"[{lang}] {text}", flush=True)
    if not shutil.which("espeak-ng"):
        raise RuntimeError("espeak-ng not installed")
    # espeak WAV goes to the configured default user-session output, including Bluetooth.
    wav = subprocess.run(["espeak-ng", "--stdout", "-v", VOICES.get(lang, lang),
                          "-s", "150", text], capture_output=True)
    if wav.returncode:
        raise RuntimeError("Text-to-speech failed: " + wav.stderr.decode(errors="replace")[:200])
    if not shutil.which("paplay"):
        raise RuntimeError("paplay unavailable; install pulseaudio-utils")
    result = subprocess.run(["paplay"], input=wav.stdout, capture_output=True)
    if result.returncode:
        raise RuntimeError("Bluetooth/default audio error: " + result.stderr.decode(errors="replace")[:300])


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
        play({"message":{"en":"Speaker test. Four Forces audio is working."}})
    else:
        main()
