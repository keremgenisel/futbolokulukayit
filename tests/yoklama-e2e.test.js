// Yoklama ekranı — tüm durumlar, gerçek main.cjs + gerçek DB + gerçek pencere: takvim şeridi, Antrenman Ekle, kartlar, işaretleme
// (+kaldırma), sayaçlar, Kalanları Geldi İşaretle, Düzenle + bildirim, Haftayı Programdan Doldur, şerit gezinme, İptal Et.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(__dirname, "..");
const electronBin = require(path.join(root, "node_modules", "electron"));

describe("Yoklama durumları (Electron altında, dist/ gerekli)", () => {
  it("scripts/tests/yoklama-e2e.cjs tüm kontrolleri geçer", () => {
    if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
      console.warn("dist/ yok — atlandı");
      return;
    }
    const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "fok-yoklama-e2e-"));
    const r = spawnSync(electronBin, [path.join(root, "scripts", "tests", "yoklama-e2e.cjs"), dizin], {
      encoding: "utf-8",
      timeout: 180000,
    });
    if (r.status !== 0 || !r.stdout.includes("TUM KONTROLLER GECTI")) console.error(r.stdout, r.stderr);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("TUM KONTROLLER GECTI");
    fs.rmSync(dizin, { recursive: true, force: true });
  }, 200000);
});
