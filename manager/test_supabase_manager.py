import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import supabase_manager as sm


class SupabaseManagerTests(unittest.TestCase):
    def test_read_env_ignores_comments_and_invalid_names(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text("# no\nGOOD='value'\nBAD-NAME=x\nEMPTY=\n", encoding="utf-8")
            self.assertEqual(sm.read_env(path), {"GOOD": "value", "EMPTY": ""})

    def test_missing_public_configuration_is_misconfigured(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True), \
                patch.object(sm.Path, "home", return_value=Path(directory) / "home"):
            result = sm.diagnostics(Path(directory))
        self.assertEqual(result["status"], "Misconfigured")
        self.assertNotIn("key", result)

    def test_migration_files_are_ordered(self):
        with tempfile.TemporaryDirectory() as directory:
            migrations = Path(directory) / "supabase" / "migrations"
            migrations.mkdir(parents=True)
            (migrations / "2_second.sql").write_text("")
            (migrations / "1_first.sql").write_text("")
            self.assertEqual([x["version"] for x in sm.migration_files(Path(directory))], ["1", "2"])

    def test_invalid_user_id_is_rejected_before_network(self):
        with self.assertRaises(ValueError):
            sm.set_user_disabled(Path("."), "not-an-id", True)


if __name__ == "__main__":
    unittest.main()
