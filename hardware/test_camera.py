import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import camera


class CameraPreviewTests(unittest.TestCase):
    def test_publish_snapshot_atomically_replaces_frame(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "frames" / "latest.jpg"
            with patch.object(camera, "SNAPSHOT_PATH", target):
                camera.publish_snapshot(b"first-jpeg")
                self.assertEqual(target.read_bytes(), b"first-jpeg")
                camera.publish_snapshot(b"second-jpeg")
                self.assertEqual(target.read_bytes(), b"second-jpeg")
                self.assertFalse(target.with_suffix(".tmp").exists())


if __name__ == "__main__":
    unittest.main()
