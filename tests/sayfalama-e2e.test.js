// Sayfalama ve sınırlı listeler: gerçek main.cjs + gerçek DB ile Oyuncular 50/sayfa, Raporlar 100/sayfa, oyuncu kartı son 12/12/40,
// Excel aktarım önizlemesi 100/sayfa, Tahsilat bugünkü makbuzlar / sezon sihirbazı / WhatsApp penceresi kaydırma kapları ve sayaçları (plan §22).
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(__dirname, "..");
const electronBin = require(path.join(root, "node_modules", "electron"));

describe("Sayfalama (Electron altında, dist/ gerekli)", () => {
  it("her sayfalı liste ve sınırlı kap beklenen satır sayısı, sayaç ve düğme durumlarını verir", () => {
    if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
      console.warn("dist/ yok — atlandı");
      return;
    }
    const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-sayfalama-e2e-"));
    const r = spawnSync(electronBin, [path.join(root, "scripts", "tests", "sayfalama-e2e.cjs"), dizin], {
      encoding: "utf-8",
      timeout: 180000,
    });
    if (r.status !== 0 || !r.stdout.includes("TUM KONTROLLER GECTI")) console.error(r.stdout, r.stderr);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("TUM KONTROLLER GECTI");
    fs.rmSync(dizin, { recursive: true, force: true });
  }, 200000);
});
