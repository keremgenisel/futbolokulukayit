// SQLite katmanı Electron altında koşmak zorunda (better-sqlite3 Electron ABI'siyle derli).
// Bu sarmalayıcı scripts/tests/db-roundtrip.cjs'yi Electron ile başlatır ve çıkışa bakar.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(__dirname, "..");

const runElectron = (script, ekArgs = []) => {
  const electronBin = require(path.join(root, "node_modules", "electron"));
  const r = spawnSync(electronBin, [path.join(root, "scripts", "tests", script), ...ekArgs], { encoding: "utf-8", timeout: 170000 });
  if (r.status !== 0) {
    console.error("STDOUT:\n" + r.stdout);
    console.error("STDERR:\n" + r.stderr);
  }
  return r;
};

describe("Arayüz duman testi (Electron altında, dist/ gerekli)", () => {
  it("giriş → parola → pano → oyuncu kartı → makbuz → yoklama → raporlar → ayarlar akışı çöker mi, makbuz PDF üretilir mi", () => {
    const fs = require("node:fs");
    if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
      console.warn("dist/ yok, önce npm run build — duman testi atlandı");
      return;
    }
    const out = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "eyupspor-smoke-out-"));
    const r = runElectron("smoke-ui.cjs", [out]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("SMOKE OK");
    expect(fs.existsSync(path.join(out, "makbuz.pdf"))).toBe(true);
    fs.rmSync(out, { recursive: true, force: true });
  }, 180000);
});

describe("SQLite katmanı (Electron altında)", () => {
  it("şema + tohum + oyuncu/aidat/makbuz/yoklama tam turu + at-rest şifreleme", () => {
    const r = runElectron("db-roundtrip.cjs");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("TUM KONTROLLER GECTI");
  }, 150000);
});
