// Gömülü sunucu uçtan uca testi Electron altında koşar (safeStorage, better-sqlite3 ABI).
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(__dirname, "..");

describe("Gömülü HTTPS sunucu güvenliği (Electron altında)", () => {
  it("401/403/429, jeton iptali, dosya yükleme, yol geçişi, sertifika sabitleme", () => {
    const electronBin = require(path.join(root, "node_modules", "electron"));
    const r = spawnSync(electronBin, [path.join(root, "scripts", "tests", "server-security.cjs")], { encoding: "utf-8", timeout: 170000 });
    if (r.status !== 0) { console.error("STDOUT:\n" + r.stdout); console.error("STDERR:\n" + r.stderr); }
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("TUM KONTROLLER GECTI");
  }, 180000);
});
