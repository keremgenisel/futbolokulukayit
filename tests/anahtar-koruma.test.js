// Veritabanı anahtarı koruması (Electron altında): çözülemeyen db-key.enc üzerine yazılmaz, init açık hata verir;
// scripts/anahtar-yeniden-sifrele.cjs eski uygulama adından yeniye taşır (macOS anahtar zinciri kaydı uygulama adına bağlı).
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(__dirname, "..");
const electronBin = require(path.join(root, "node_modules", "electron"));

describe("Anahtar dosyası koruması ve yeniden şifreleme", () => {
  it("çözülemeyen anahtar korunur; betik adlar arası taşır", () => {
    const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "anahtar-koruma-"));
    const r = spawnSync(electronBin, [path.join(root, "scripts", "tests", "anahtar-koruma.cjs"), dizin], {
      encoding: "utf-8",
      timeout: 120000,
    });
    if (r.status !== 0 || !r.stdout.includes("TUM KONTROLLER GECTI")) console.error(r.stdout, r.stderr);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("TUM KONTROLLER GECTI");
    fs.rmSync(dizin, { recursive: true, force: true });
  }, 150000);
});
