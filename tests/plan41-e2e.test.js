// 13.09.2026 işleri uçtan uca (plan §41 + sürüm notu + takvim noktaları + program eşitleme): scripts/tests/plan41-e2e.cjs (dist/ gerekir).
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(__dirname, "..");
const electronBin = require(path.join(root, "node_modules", "electron"));

describe("Plan §41 ve 13.09.2026 düzeltmeleri (Electron altında, dist/ gerekli)", () => {
  it("kişisel veri silme art arda, ayrılan borçlular, Kesilen Makbuzlar, sürüm notu, takvim noktaları, program eşitleme, roller", () => {
    if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
      console.warn("dist/ yok — atlandı");
      return;
    }
    const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-plan41-e2e-"));
    const r = spawnSync(electronBin, [path.join(root, "scripts", "tests", "plan41-e2e.cjs"), dizin], {
      encoding: "utf-8",
      timeout: 240000,
    });
    if (r.status !== 0 || !r.stdout.includes("TUM KONTROLLER GECTI")) console.error(r.stdout, r.stderr);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("TUM KONTROLLER GECTI");
    fs.rmSync(dizin, { recursive: true, force: true });
  }, 260000);
});
