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


def siren():
    if SIREN_WAV.exists() and shutil.which("aplay"):
        subprocess.run(["aplay", "-q", str(SIREN_WAV)])
    else:
        say("Alert! Alert!", "en")


def say(text: str, lang: str):
    print(f"[{lang}] {text}")
    if shutil.which("espeak-ng"):
        subprocess.run(["espeak-ng", "-v", VOICES.get(lang, lang), "-s", "150", "-a", "200", text])


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
    state_file = Path(os.getenv("SPEAKER_STATE", "/var/lib/hackformiami-hardware/last_alert_id"))
    try: last_id = state_file.read_text().strip() or None
    except OSError: last_id = None
    first = True
    last_tide_check, tide_risk = 0.0, "low"
    print(f"Listening to {SERVER_URL} ...")
    while True:
        try:
            alert = requests.get(f"{SERVER_URL}/api/alerts/latest", timeout=5).json().get("alert")
            if time.time() - last_tide_check > 60:
                tide_risk = requests.get(f"{SERVER_URL}/api/tide", timeout=10).json().get("risk") or "low"
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
    main()
