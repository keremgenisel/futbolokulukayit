import { describe, it, expect } from "vitest";
import { aidatBaslangicDurumu, tesiseGirebilir, donemSonGunu, gecikmeGunu, paraTR, tarihTR } from "../src/lib/aidat.js";

describe("aidatBaslangicDurumu", () => {
  it("aktif + normal ücret → ödenmedi olarak açılır", () => {
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "normal", aylik_aidat: 3500 })).toBe("odenmedi");
  });
  it("burslu ve ücretsiz → muaf", () => {
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "burslu", aylik_aidat: 3500 })).toBe("muaf");
    expect(aidatBaslangicDurumu({ durum: "deneme", ucret_tipi: "ucretsiz", aylik_aidat: 0 })).toBe("muaf");
  });
  it("indirimli ve kardeş indirimi ödeme bekler", () => {
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "indirimli", aylik_aidat: 2500 })).toBe("odenmedi");
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "kardes", aylik_aidat: 3000 })).toBe("odenmedi");
  });
  it("dondurma, pasif, ayrıldı → kayıt açılmaz", () => {
    for (const d of ["dondurma", "pasif", "ayrildi"]) {
      expect(aidatBaslangicDurumu({ durum: d, ucret_tipi: "normal", aylik_aidat: 3500 })).toBeNull();
    }
  });
  it("tutar 0 ise muaf", () => {
    expect(aidatBaslangicDurumu({ durum: "aktif", ucret_tipi: "normal", aylik_aidat: 0 })).toBe("muaf");
  });
});

describe("tesiseGirebilir", () => {
  it("ödendi veya muaf → girebilir", () => {
    expect(tesiseGirebilir({ durum: "aktif" }, { durum: "odendi" })).toBe(true);
    expect(tesiseGirebilir({ durum: "aktif" }, { durum: "muaf" })).toBe(true);
  });
  it("ödenmedi veya kayıt yok → giremez", () => {
    expect(tesiseGirebilir({ durum: "aktif" }, { durum: "odenmedi" })).toBe(false);
    expect(tesiseGirebilir({ durum: "aktif" }, null)).toBe(false);
  });
  it("dondurmadaki oyuncu ödese bile giremez", () => {
    expect(tesiseGirebilir({ durum: "dondurma" }, { durum: "odendi" })).toBe(false);
  });
});

describe("ödeme dönemi", () => {
  it("dönem son günleri", () => {
    expect(donemSonGunu("1-10", 2026, 9)).toBe(10);
    expect(donemSonGunu("11-20", 2026, 9)).toBe(20);
    expect(donemSonGunu("21-31", 2026, 9)).toBe(30);
    expect(donemSonGunu("21-31", 2026, 2)).toBe(28);
  });
  it("gecikme günü hesaplanır, dönem geçmediyse 0", () => {
    expect(gecikmeGunu("1-10", 2026, 9, new Date(2026, 8, 16))).toBe(6);
    expect(gecikmeGunu("1-10", 2026, 9, new Date(2026, 8, 5))).toBe(0);
  });
});

describe("biçimleme", () => {
  it("para ve tarih Türkçe", () => {
    expect(paraTR(3500)).toBe("3.500 ₺");
    expect(paraTR(4850.5)).toBe("4.850,5 ₺");
    expect(tarihTR("2015-11-02")).toBe("02.11.2015");
    expect(tarihTR("")).toBe("");
  });
});
