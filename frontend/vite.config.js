import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api -> backend Django, ca sa eviti probleme de CORS in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
