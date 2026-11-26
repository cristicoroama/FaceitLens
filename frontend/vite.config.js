import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Proxy /api -> backend Django, ca sa eviti probleme de CORS in dev.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\/]node_modules[\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\/]/.test(id)) return "react-vendor";
          if (/[\/]node_modules[\/](recharts|recharts-scale|victory-vendor|d3-[^\/]+|internmap|decimal\.js-light|react-smooth|eventemitter3|tiny-invariant|lodash)[\/]/.test(id)) return "charts";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
