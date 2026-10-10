"""Regression tests for FastAPI's Vite SPA routing."""
from pathlib import Path
import unittest

from fastapi.testclient import TestClient

import main


client = TestClient(main.app)
react_index = (Path(__file__).parent.parent / "web" / "dist" / "index.html").read_bytes()
legacy_index = (Path(__file__).parent.parent / "app" / "index.html").read_bytes()


class FrontendRouteTests(unittest.TestCase):
    def test_react_routes_use_vite_index(self):
        routes = (
            "/", "/login", "/signup", "/app/", "/account", "/reports", "/alerts", "/settings"
        )
        for route in routes:
            with self.subTest(route=route):
                response = client.get(route)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.content, react_index)
                self.assertNotEqual(response.content, legacy_index)

    def test_nested_app_route_uses_spa_fallback(self):
        response = client.get("/app/saved-view")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, react_index)

    def test_vite_asset_is_served_and_api_is_not_captured(self):
        asset = next(
            path for path in (Path(__file__).parent.parent / "web" / "dist" / "assets").rglob("*")
            if path.is_file()
        )
        relative_asset = asset.relative_to(Path(__file__).parent.parent / "web" / "dist")
        response = client.get(f"/{relative_asset.as_posix()}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, asset.read_bytes())

        response = client.get("/api/does-not-exist")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(response.headers["content-type"].startswith("application/json"))

    def test_legacy_application_is_not_publicly_mounted(self):
        response = client.get("/legacy-app/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, react_index)
        self.assertNotEqual(response.content, legacy_index)


if __name__ == "__main__":
    unittest.main()
