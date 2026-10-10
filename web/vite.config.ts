import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const envDir = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  return {
    envDir,
    envPrefix: ["VITE_", "NEXT_PUBLIC_SUPABASE_"],
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    server: {
      port: 5173,
      proxy: { "/api": { target: env.DEV_API_PROXY ?? "http://localhost:8000", changeOrigin: true } },
    },
    build: { outDir: "dist", target: "es2022" },
  };
});
