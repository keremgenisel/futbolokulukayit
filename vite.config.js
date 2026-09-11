import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Güvenlik 2. inceleme #3 (11.09.2026): index.html'deki CSP ÜRETİM değeridir (connect-src 'self'); dev sunucusu/HMR için gereken
// localhost adresleri yalnız `vite` (serve) modunda eklenir — paketli sürümde kalmaz.
export const DEV_CONNECT = "http://localhost:5173 ws://localhost:5173";
export const cspDev = (html) => html.replace("connect-src 'self'", `connect-src 'self' ${DEV_CONNECT}`);

export default defineConfig({
  plugins: [react(), { name: "csp-dev", apply: "serve", transformIndexHtml: cspDev }],
  base: "./", // Electron file:// protokolü için gerekli
  server: { port: 5173, strictPort: true },
});
