import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// ByteGuard frontend dev server. The v0 preview auto-detects the open port.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.PORT) || 3000,
    strictPort: false,
    // Allow the v0 preview proxy domains (e.g. *.vercel.run) to reach the dev server.
    allowedHosts: true,
    // Proxy API calls to the FastAPI backend during local dev.
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})
