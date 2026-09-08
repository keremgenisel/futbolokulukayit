// Güvenlik incelemesi (08.09.2026) saf yardımcıları: makbuz PDF izni (#4), belge girdi doğrulama (#15), resim boyutu (#22).
import { describe, it, expect } from "vitest";
import { makbuzPdfIzni } from "../electron/makbuzIzin.cjs";
import { belgeGirdiDogrula, BELGE_TIPLERI } from "../electron/belgeDogrula.cjs";
import { resimBoyutu, MAX_PIKSEL } from "../electron/imageOptimize.cjs";

describe("makbuzPdfIzni", () => {
  const admin = { username: "a", role: "admin" },
    kul = { username: "k", role: "kullanici" };
  it("oturumsuz / salt okunur / makbuz yok / iptal → red", () => {
    expect(makbuzPdfIzni(null, { id: 1 }, false).ok).toBe(false);
    expect(makbuzPdfIzni(kul, { id: 1 }, true).neden).toMatch(/salt okunur/);
    expect(makbuzPdfIzni(kul, null, false).neden).toMatch(/bulunamadı/);
    expect(makbuzPdfIzni(admin, { id: 1, iptal: 1 }, false).neden).toMatch(/İptal/);
  });
  it("PDF'i olmayan makbuzu herkes üretir; olanı yalnız yönetici yeniden üretir", () => {
    expect(makbuzPdfIzni(kul, { id: 1, iptal: 0, pdf_yolu: null }, false).ok).toBe(true);
    expect(makbuzPdfIzni(kul, { id: 1, iptal: 0, pdf_yolu: "makbuz/1.pdf" }, false).neden).toMatch(/yönetici/);
    expect(makbuzPdfIzni(admin, { id: 1, iptal: 0, pdf_yolu: "makbuz/1.pdf" }, false).ok).toBe(true);
  });
});

describe("belgeGirdiDogrula", () => {
  it("geçerli girdi normalize edilir", () => {
    expect(belgeGirdiDogrula({ playerId: "7", tip: "saglik", gecerlilik: "2027-01-01" })).toEqual({
      playerId: 7,
      tip: "saglik",
      gecerlilik: "2027-01-01",
    });
    expect(belgeGirdiDogrula({ playerId: 3, tip: "foto" })).toEqual({ playerId: 3, tip: "foto", gecerlilik: null });
    expect([...BELGE_TIPLERI]).toEqual(["saglik", "foto", "sporcu_kimlik", "veli_kimlik", "kayit_formu", "diger"]);
  });
  it("yol geçişi / bilinmeyen tip / geçersiz id ve tarih reddedilir", () => {
    expect(() => belgeGirdiDogrula({ playerId: 1, tip: "../x" })).toThrow("Geçersiz belge türü");
    expect(() => belgeGirdiDogrula({ playerId: 1, tip: "a/b" })).toThrow("Geçersiz belge türü");
    expect(() => belgeGirdiDogrula({ playerId: "abc", tip: "foto" })).toThrow("Geçersiz oyuncu");
    expect(() => belgeGirdiDogrula({ playerId: 0, tip: "foto" })).toThrow("Geçersiz oyuncu");
    expect(() => belgeGirdiDogrula({ playerId: 1.5, tip: "foto" })).toThrow("Geçersiz oyuncu");
    expect(() => belgeGirdiDogrula({ playerId: 1, tip: "saglik", gecerlilik: "01.01.2027" })).toThrow("tarihi geçersiz");
  });
});

describe("resimBoyutu (dekompresyon bombası korunması)", () => {
  const png = (w, h) => {
    const b = Buffer.alloc(33, 0);
    b.writeUInt32BE(0x89504e47, 0);
    b.write("IHDR", 12, "ascii");
    b.writeUInt32BE(w, 16);
    b.writeUInt32BE(h, 20);
    return b;
  };
  it("PNG IHDR'dan boyut okur", () => {
    expect(resimBoyutu(png(4000, 3000))).toEqual({ width: 4000, height: 3000 });
    expect(resimBoyutu(png(20000, 20000)).width * 20000).toBeGreaterThan(MAX_PIKSEL);
  });
  it("JPEG SOF0'dan boyut okur", () => {
    const j = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x0b, 0xb8, 0x0f, 0xa0, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0,
    ]);
    expect(resimBoyutu(j)).toEqual({ height: 3000, width: 4000 });
  });
  it("tanınmayan içerik null", () => {
    expect(resimBoyutu(Buffer.from("%PDF-1.4 ......................"))).toBeNull();
    expect(resimBoyutu(Buffer.alloc(3))).toBeNull();
  });
});
