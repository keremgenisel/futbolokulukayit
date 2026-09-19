// Yol geçişi koruması (19.09.2026): uploads kökü dışına çıkan her giriş reddedilir.
// Kod taramasında "path-join-resolve-traversal" uyarıları bu TEK noktaya indirildi; davranışı burada kilitliyoruz.
import { describe, it, expect } from "vitest";
import path from "node:path";
import { uploadsIciYol } from "../electron/guvenliYol.cjs";

const KOK = path.resolve("/tmp/uploads-testi");

describe("uploadsIciYol", () => {
  it("kök içindeki parçaları birleştirir; kökün kendisi geçerli", () => {
    expect(uploadsIciYol(KOK, "oyuncu-5", "1-foto.jpg")).toBe(path.join(KOK, "oyuncu-5", "1-foto.jpg"));
    expect(uploadsIciYol(KOK, "makbuz")).toBe(path.join(KOK, "makbuz"));
    expect(uploadsIciYol(KOK)).toBe(KOK);
    expect(uploadsIciYol(KOK, "oyuncu-5/alt/dosya.pdf")).toBe(path.join(KOK, "oyuncu-5", "alt", "dosya.pdf"));
    expect(uploadsIciYol(KOK, "oyuncu-" + 7, "a.png")).toBe(path.join(KOK, "oyuncu-7", "a.png")); // sayı parçası
  });
  it("üst dizine çıkan, mutlak ve NUL baytlı yollar reddedilir", () => {
    for (const kotu of [
      ["..", "etc", "passwd"],
      ["oyuncu-5", "..", "..", "gizli.txt"],
      ["../../../../etc/passwd"],
      [path.resolve("/etc/passwd")],
      ["oyuncu-5/foto\0.png"],
    ])
      expect(() => uploadsIciYol(KOK, ...kotu), JSON.stringify(kotu)).toThrow("Geçersiz dosya yolu");
  });
  it("kök adının uzantısı olan kardeş klasöre sızmaz (uploads-eski)", () => {
    expect(() => uploadsIciYol(KOK, "..", path.basename(KOK) + "-eski", "x.png")).toThrow("Geçersiz dosya yolu");
  });
});
