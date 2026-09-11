// Güvenlik 2. inceleme #2: geçici çıktı PDF'leri tek klasörde, 24 saatten eskiler açılışta silinir; eski sürüm artıkları da.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ciktiKlasoru, ciktiArtiklariTemizle, artikMi, KLASOR_ADI } from "../electron/geciciCikti.cjs";

describe("geçici çıktı temizliği", () => {
  it("klasör oluşur; 24 saatten eski dosyalar ve eski biçim artıklar silinir, yeniler kalır", () => {
    const kok = fs.mkdtempSync(path.join(os.tmpdir(), "fok-cikti-test-"));
    const k = ciktiKlasoru(kok);
    expect(k).toBe(path.join(kok, KLASOR_ADI));
    const now = Date.now();
    const yaz = (yol, yasMs) => {
      fs.writeFileSync(yol, "pdf");
      const t = new Date(now - yasMs);
      fs.utimesSync(yol, t, t);
    };
    yaz(path.join(k, "futbolokulu-1-makbuz.pdf"), 25 * 3600 * 1000); // eski → silinir
    yaz(path.join(k, "futbolokulu-2-yoklama.pdf"), 1 * 3600 * 1000); // yeni → kalır
    yaz(path.join(kok, "futbolokulu-3-eski.pdf"), 48 * 3600 * 1000); // eski sürümün doğrudan temp'e yazdığı → silinir
    yaz(path.join(kok, "baska-uygulama.pdf"), 48 * 3600 * 1000); // bize ait değil → dokunulmaz
    expect(ciktiArtiklariTemizle(kok, now)).toBe(2);
    expect(fs.existsSync(path.join(k, "futbolokulu-1-makbuz.pdf"))).toBe(false);
    expect(fs.existsSync(path.join(k, "futbolokulu-2-yoklama.pdf"))).toBe(true);
    expect(fs.existsSync(path.join(kok, "futbolokulu-3-eski.pdf"))).toBe(false);
    expect(fs.existsSync(path.join(kok, "baska-uygulama.pdf"))).toBe(true);
    expect(artikMi(now - 1000, now)).toBe(false);
    fs.rmSync(kok, { recursive: true, force: true });
  });
  it("olmayan kök hata fırlatmaz", () => {
    expect(ciktiArtiklariTemizle(path.join(os.tmpdir(), "yok-boyle-bir-klasor-fok"), Date.now())).toBe(0);
  });
});
