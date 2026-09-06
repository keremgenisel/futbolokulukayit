import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx}"],
    // Electron başlatan testler (db-electron, server-security) aynı anda koşunca zamanlama hataları
    // veriyor; dosyalar sırayla çalışır (toplam süre ~3 dk).
    fileParallelism: false,
  },
});
