// Yeni Sezon sihirbazı: gerçek main.cjs ile aynı userData'da iki oturum (sihirbaz → yeniden açılış). dist/ gerekir.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const root = path.join(__dirname, "..");
const electronBin = require(path.join(root, "node_modules", "electron"));
const kos = (dizin, adim) =>
  spawnSync(electronBin, [path.join(root, "scripts", "tests", "sezon-e2e.cjs"), dizin, adim], { encoding: "utf-8", timeout: 180000 });

describe("Yeni Sezon sihirbazı (Electron altında, dist/ gerekli)", () => {
  it("adaylar, üst grup önerileri (sonekli/gövdeye düşen), filtre/arama, onay, geçiş sonucu, pasife alma, borç silme ve yeniden açılış", () => {
    if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
      console.warn("dist/ yok — atlandı");
      return;
    }
    const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-sezon-"));
    const y = kos(dizin, "yaz");
    if (!/YAZ TAMAM/.test(y.stdout)) console.error(y.stdout, y.stderr);
    expect(y.stdout).toContain("YAZ TAMAM");
    const o = kos(dizin, "oku");
    if (o.status !== 0) console.error(o.stdout, o.stderr);
    expect(o.stdout).toContain("TUM KONTROLLER GECTI");
    fs.rmSync(dizin, { recursive: true, force: true });
  }, 400000);
});
