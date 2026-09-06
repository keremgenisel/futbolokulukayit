// Kalıcılık: gerçek main.cjs ile aynı userData'da iki oturum (düzgün kapanış ve SIGKILL).
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(__dirname, "..");
const electronBin = require(path.join(root, "node_modules", "electron"));
const kos = (dizin, adim, env = {}) => spawnSync(electronBin, [path.join(root, "scripts", "tests", "kalicilik.cjs"), dizin, adim], { encoding: "utf-8", timeout: 120000, env: { ...process.env, ...env } });

describe("Veri kalıcılığı (Electron altında, dist/ gerekli)", () => {
  const senaryolar = [["düzgün kapanış (pencere kapatma)", {}], ["kaba kapanış (SIGKILL)", { KABA_KAPANIS: "1" }]];
  for (const [ad, env] of senaryolar) {
    it(ad + " sonrası parola, grup, oyuncu, ayar, makbuz, yoklama ve lisans meta yerinde", () => {
      if (!fs.existsSync(path.join(root, "dist", "index.html"))) { console.warn("dist/ yok — atlandı"); return; }
      const dizin = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-kalicilik-"));
      const y = kos(dizin, "yaz", env);
      expect(y.stdout).toContain("YAZ TAMAM");
      const o = kos(dizin, "oku");
      if (o.status !== 0) console.error(o.stdout, o.stderr);
      expect(o.status).toBe(0);
      expect(o.stdout).toContain("TUM KONTROLLER GECTI");
      fs.rmSync(dizin, { recursive: true, force: true });
    }, 250000);
  }
});
