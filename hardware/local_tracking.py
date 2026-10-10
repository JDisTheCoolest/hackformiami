"""Local, ephemeral camera tracking. No recognition or persistent identities.

MobileNet-SSD (OpenCV DNN) detects people, centroid matching assigns session-only IDs. It is NOT a
fight detector: close fast movement only produces review candidates.
"""
import collections
import math
import time
from pathlib import Path

MODEL_DIR = Path("/opt/hackformiami/hardware/models")
CONFIDENCE = 0.75

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
        if self.detector is None:
            proto = MODEL_DIR / "deploy.prototxt"
            weights = MODEL_DIR / "mobilenet_iter_73000.caffemodel"
            if not proto.is_file() or not weights.is_file():
                raise FileNotFoundError("MobileNet-SSD model not installed. Run deploy/install-hardware.sh")
            self.detector = cv2.dnn.readNetFromCaffe(str(proto), str(weights))
            self.detector.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
            self.detector.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        height, width = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(cv2.resize(frame,(300,300)), 0.007843,
                                     (300,300), 127.5)
        self.detector.setInput(blob)
        out = self.detector.forward()
        detections = []
        for i in range(out.shape[2]):
            confidence = float(out[0,0,i,2])
            category = int(out[0,0,i,1])
            if category != 15 or confidence < CONFIDENCE: # VOC person only
                continue
            x1,y1,x2,y2 = out[0,0,i,3:7]
            x1,y1,x2,y2 = (max(0,min(1,float(v))) for v in (x1,y1,x2,y2))
            if x2 <= x1 or y2 <= y1:
                continue
            w,h = (x2-x1)*width,(y2-y1)*height
            detections.append(((x1+x2)*width/2,(y1+y2)*height/2,w,h))
        t = time.monotonic()
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
        return {"people":[{"id":pid,"x":round((p["x"]-p["w"]/2)/width,4),"y":round((p["y"]-p["h"]/2)/height,4),"w":round(p["w"]/width,4),"h":round(p["h"]/height,4),"label":f"Person {pid}"} for pid,p in updated.items()],
                "candidates":candidates, "frames_in_memory":len(self.frames)}
