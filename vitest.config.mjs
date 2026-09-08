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
    // Kapsama: yalnız süreç içi (saf + jsdom) testler ölçülür; Electron alt süreçlerinde koşan kod (db.cjs vb.)
    // buraya yansımaz. Bkz. docs/refactor-plan.md.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}", "electron/**/*.cjs"],
      exclude: ["src/main.jsx"],
      reporter: ["text-summary", "text", "html"],
      reportsDirectory: "coverage",
    },
  },
});
