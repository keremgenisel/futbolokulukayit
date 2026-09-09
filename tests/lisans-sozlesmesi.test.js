// Kurulum sihirbazının lisans sözleşmesi sayfası (NSIS): build/license.txt var, UTF-8 BOM'lu (Unicode NSIS Türkçe harfleri böyle
// doğru gösterir), CRLF satır sonlu, ürün adını ve lisans vereni içerir; package.json nsis.license bu dosyayı gösterir.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const kok = path.join(__dirname, "..");

describe("Kurulum lisans sözleşmesi", () => {
  it("build/license.txt: BOM + CRLF, ürün adı ve lisans veren; package.json nsis.license onu gösterir", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(kok, "package.json"), "utf-8"));
    expect(pkg.build.nsis.license).toBe("build/license.txt");
    const ham = fs.readFileSync(path.join(kok, pkg.build.nsis.license));
    expect([ham[0], ham[1], ham[2]]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const metin = ham.toString("utf-8").slice(1);
    expect(metin).toContain("FUTBOL OKULU KAYIT PROGRAMI");
    expect(metin).toContain("SON KULLANICI LİSANS SÖZLEŞMESİ");
    expect(metin).toContain("Kerem Genişel");
    expect(metin).toContain("6698 sayılı");
    expect(metin.includes("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(metin)).toBe(false); // yalnız CRLF
    expect(metin.length).toBeGreaterThan(3000);
  });
});
