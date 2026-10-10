"""Local, ephemeral camera tracking. No recognition or persistent identities.

HOG detects people, centroid matching assigns session-only IDs. It is NOT a
fight detector: close fast movement only produces review candidates.
"""
import collections
import math
import time

class PersonTracker:
    def __init__(self, history=20):
        self.frames = collections.deque(maxlen=history)
        self.people = {}
        self.next_id = 1
        self.detector = None

    def update(self, image):
        import cv2
        import numpy as np
        frame = cv2.imdecode(np.frombuffer(image, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            return {"people": [], "candidates": [], "frames_in_memory": len(self.frames)}
        scale = min(1.0, 400.0 / max(frame.shape[:2]))
        small = cv2.resize(frame, None, fx=scale, fy=scale)
        if self.detector is None:
            self.detector = cv2.HOGDescriptor()
            self.detector.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        boxes, _ = self.detector.detectMultiScale(small, winStride=(8, 8), padding=(8, 8), scale=1.10)
        t = time.monotonic()
        detections = [(float(x+w/2), float(y+h/2), int(w), int(h)) for x,y,w,h in boxes]
        used = set()
        updated = {}
        candidates = []
        for x,y,w,h in detections:
            possibilities = [(math.hypot(x-p["x"], y-p["y"]), pid) for pid,p in self.people.items()
                             if pid not in used and t-p["time"] < 5]
            distance, pid = min(possibilities, default=(1e9,None))
            if distance > 75: pid = self.next_id; self.next_id += 1
            prev = self.people.get(pid)
            speed = math.hypot(x-prev["x"],y-prev["y"])/max(.1,t-prev["time"]) if prev else 0
            updated[pid] = {"x":x,"y":y,"w":w,"h":h,"time":t,"speed":round(speed,1)}
            used.add(pid)
        self.people = updated
        ids = list(updated)
        for i in range(len(ids)):
            for j in range(i+1,len(ids)):
                a,b=updated[ids[i]],updated[ids[j]]
                close=math.hypot(a["x"]-b["x"],a["y"]-b["y"]) < max(a["w"],b["w"])*1.5
                if close and max(a["speed"],b["speed"]) > 40:
                    candidates.append({"ids":[ids[i],ids[j]],"reason":"fast nearby movement; not proof of hitting"})
        self.frames.append((t, image))
        return {"people":[{"id":pid,"x":round((p["x"]-p["w"]/2)/small.shape[1],4),"y":round((p["y"]-p["h"]/2)/small.shape[0],4),"w":round(p["w"]/small.shape[1],4),"h":round(p["h"]/small.shape[0],4),"label":f"Person {pid}"} for pid,p in updated.items()],
                "candidates":candidates, "frames_in_memory":len(self.frames)}
