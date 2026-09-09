// Taşıma paketi uçtan uca: gerçek main.cjs, iki ayrı userData (eski PC → yeni PC), arayüzden oluştur/geri yükle/doğrula.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.join(__dirname, "..");
const electronBin = require(path.join(root, "node_modules", "electron"));

describe("Taşıma paketi (Electron altında, dist/ gerekli)", () => {
  it("arayüzden paket oluştur → yeni PC'de arayüzden geri yükle → yeniden açılışta veri ve parola eski PC'ninki", () => {
    if (!fs.existsSync(path.join(root, "dist", "index.html"))) {
      console.warn("dist/ yok — atlandı");
      return;
    }
    const eski = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-e2e-eski-"));
    const yeni = fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-e2e-yeni-"));
    // Hiçbir dizin adı "eyupspor-tasima-"/"eyupspor-geri-" ile BAŞLAMAMALI: uygulama açılışta os.tmpdir()'deki o önekli klasörleri
    // geçici artık sayıp siler (güvenlik #8) — userData da silinirdi
    const paket = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "eyupspor-paket-")), "eyupspor-tasima-test.eyupspor");
    for (const adim of ["olustur", "geriyukle", "dogrula"]) {
      const r = spawnSync(electronBin, [path.join(root, "scripts", "tests", "tasima-e2e.cjs"), eski, yeni, paket, adim], {
        encoding: "utf-8",
        timeout: 120000,
      });
      if (r.status !== 0 || !r.stdout.includes("TUM KONTROLLER GECTI")) console.error(adim, r.stdout, r.stderr);
      expect(r.status, adim).toBe(0);
      expect(r.stdout, adim).toContain("TUM KONTROLLER GECTI");
    }
    for (const d of [eski, yeni, path.dirname(paket)]) fs.rmSync(d, { recursive: true, force: true });
  }, 300000);
});
