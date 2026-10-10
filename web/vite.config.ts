import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Env files (.env.local etc.) live at the repository root, not in web/.
const envDir = fileURLToPath(new URL("..", import.meta.url));

// The 4forces backend (backend/main.py) runs on :8000 in development.
// /api requests are proxied there so the site can read live data without CORS setup.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  return {
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: env.DEV_API_PROXY ?? "http://localhost:8000", changeOrigin: true },
      },
    },
    build: { outDir: "dist", target: "es2022" },
  };
});
