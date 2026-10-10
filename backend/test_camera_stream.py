"""Security and lifecycle tests for the browser-compatible camera stream."""
import time
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

import main


class CameraStreamTests(unittest.TestCase):
    def setUp(self):
        with main.stream_lock:
            main.stream_tokens.clear()
            main.stream_viewers = 0

    def test_stream_requires_one_use_authorization(self):
        with self.assertRaises(HTTPException) as denied:
            main.camera_stream(camera_stream=None)
        self.assertEqual(denied.exception.status_code, 401)

        with main.stream_lock:
            main.stream_tokens["once"] = time.monotonic() + 30
        response = main.camera_stream(fps=999, camera_stream="once")
        self.assertIn("multipart/x-mixed-replace", response.media_type)
        self.assertEqual(main.stream_viewers, 1)
        with self.assertRaises(HTTPException):
            main.camera_stream(camera_stream="once")
        with main.stream_lock:
            main.stream_viewers = 0

    def test_frame_generator_releases_viewer(self):
        with tempfile.TemporaryDirectory() as directory:
            frame = Path(directory) / "latest.jpg"
            frame.write_bytes(b"jpeg")
            with patch.object(main, "CAMERA_SNAPSHOT_PATH", frame):
                main.stream_viewers = 1
                frames = main._camera_frames(15)
                self.assertIn(b"jpeg", next(frames))
                frames.close()
        self.assertEqual(main.stream_viewers, 0)

    def test_session_uses_secure_httponly_cookie(self):
        with patch.object(main, "verified_supabase_user", return_value={"id": "user-1"}):
            response = main.camera_stream_session("Bearer valid")
        cookie = response.headers["set-cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("SameSite=strict", cookie)
        self.assertIn("Path=/api/camera/stream", cookie)

    def test_status_stays_supabase_protected(self):
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(main, "verified_supabase_user") as verify, \
             patch.object(main, "CAMERA_STATUS_PATH", Path(directory) / "missing.json"):
                status = main.camera_status("Bearer valid")
        verify.assert_called_once_with("Bearer valid")
        self.assertFalse(status["connected"])


if __name__ == "__main__":
    unittest.main()
