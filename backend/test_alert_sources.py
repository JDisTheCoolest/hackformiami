"""Run: python test_alert_sources.py  (no server needed)"""
import tempfile
from pathlib import Path
import core


def rep(i, rid):
    return {"id": f"r_{i}", "lat": 25.765, "lng": -80.188, "area": "Brickell", "created_at": core.now_iso(),
            "reporter_id": rid, "status": "done",
            "analysis": {"is_disaster": True, "type": "flood", "severity": "severe", "confidence": 0.9,
                         "summary": {"en": "x", "es": "x", "ht": "x"}}}


def run(reporters):
    store = core.Store(Path(tempfile.mkdtemp()) / "db.json")
    alert = None
    for i, rid in enumerate(reporters):
        r = rep(i, rid)
        store.add_report(r)
        alert = core.maybe_create_alert(store, r, 3, 1000, 60, 0.5) or alert
    return alert


assert run(["cam1", "cam1", "cam1"]) is None            # same camera x3: no alert
assert run(["cam1"] * 5) is None
a = run(["cam1", "app_a", "app_b"])                      # camera + 2 neighbors: alert
assert a and a["count"] == 3
a = run(["cam1", "cam1", "app_a", "app_b"])              # camera repeats: still 3 sources
assert a and a["count"] == 3 and len(a["report_ids"]) == 4
assert run(["", "", ""])["count"] == 3                   # no reporter_id: each counts
print("ok")
