import io
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import camera


class CameraCaptureTests(unittest.TestCase):
    def setUp(self):
        camera._capture_log.update(last=0.0, failed=False)

    def test_usb_capture_uses_discovered_device(self):
        with tempfile.TemporaryDirectory() as directory:
            output, device = Path(directory) / "frame.jpg", Path("/dev/video2")
            def run(command, **_kwargs):
                self.assertEqual(command[command.index("-d") + 1], str(device))
                output.write_bytes(b"fresh-jpeg")
            with patch.object(camera, "capture_methods", return_value=["fswebcam"]), patch.object(camera, "video_devices", return_value=[device]), \
                 patch.object(camera.shutil, "which", return_value="/usr/bin/fswebcam"), patch.object(camera.subprocess, "run", side_effect=run):
                self.assertTrue(camera.capture(output))
                self.assertEqual(output.read_bytes(), b"fresh-jpeg")

    def test_failed_capture_removes_stale_frame(self):
        with tempfile.TemporaryDirectory() as directory:
            output, device = Path(directory) / "frame.jpg", Path("/dev/video0")
            output.write_bytes(b"stale-jpeg")
            failure = subprocess.CalledProcessError(1, "fswebcam", stderr=b"device disconnected")
            with patch.object(camera, "capture_methods", return_value=["fswebcam"]), patch.object(camera, "video_devices", return_value=[device]), \
                 patch.object(camera.shutil, "which", return_value="/usr/bin/fswebcam"), patch.object(camera.subprocess, "run", side_effect=failure):
                self.assertFalse(camera.capture(output))
                self.assertFalse(output.exists())

    def test_disconnect_then_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            output, device = Path(directory) / "frame.jpg", Path("/dev/video4")
            calls = 0
            def run(_command, **_kwargs):
                nonlocal calls
                calls += 1
                if calls == 1:
                    raise subprocess.CalledProcessError(1, "fswebcam", stderr=b"gone")
                output.write_bytes(b"recovered")
            log = io.StringIO()
            with patch.object(camera, "capture_methods", return_value=["fswebcam"]), patch.object(camera, "video_devices", return_value=[device]), \
                 patch.object(camera.shutil, "which", return_value="/usr/bin/fswebcam"), patch.object(camera.subprocess, "run", side_effect=run), redirect_stdout(log):
                self.assertFalse(camera.capture(output))
                self.assertTrue(camera.capture(output))
            self.assertIn("capture recovered", log.getvalue().lower())

    def test_failed_capture_is_never_published_or_returned_for_ai(self):
        with tempfile.TemporaryDirectory() as directory:
            shot, published = Path(directory) / "shot.jpg", Path(directory) / "latest.jpg"
            shot.write_bytes(b"old-frame")
            with patch.object(camera, "capture", return_value=False), patch.object(camera, "SNAPSHOT_PATH", published), \
                 patch.object(camera, "publish_snapshot") as publish:
                self.assertIsNone(camera.capture_frame(shot))
                publish.assert_not_called()

    def test_publish_snapshot_atomically_replaces_frame(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "frames" / "latest.jpg"
            with patch.object(camera, "SNAPSHOT_PATH", target):
                camera.publish_snapshot(b"first")
                camera.publish_snapshot(b"second")
            self.assertEqual(target.read_bytes(), b"second")
            self.assertFalse(target.with_suffix(".tmp").exists())


if __name__ == "__main__":
    unittest.main()
