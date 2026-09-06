// SQLite katmanı Electron altında koşmak zorunda (better-sqlite3 Electron ABI'siyle derli).
// Bu sarmalayıcı scripts/tests/db-roundtrip.cjs'yi Electron ile başlatır ve çıkışa bakar.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(__dirname, "..");

const runElectron = (script) => {
  const electronBin = require(path.join(root, "node_modules", "electron"));
  const r = spawnSync(electronBin, [path.join(root, "scripts", "tests", script)], { encoding: "utf-8", timeout: 120000 });
  if (r.status !== 0) { console.error("STDOUT:\n" + r.stdout); console.error("STDERR:\n" + r.stderr); }
  return r;
};

describe("SQLite katmanı (Electron altında)", () => {
  it("şema + tohum + oyuncu/aidat/makbuz/yoklama tam turu + at-rest şifreleme", () => {
    const r = runElectron("db-roundtrip.cjs");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("TUM KONTROLLER GECTI");
  }, 150000);
});
