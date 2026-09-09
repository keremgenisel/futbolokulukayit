// Kalıcı lisans-meta birleştirme (Faz B1) — saf mantık: deneme-sıfırlama ve saat-geri-alma
// sertleştirmesi. Regresyon: birleştirme "en erken kurulum / en ileri işaret" kuralını bozarsa
// DB'yi silerek 30 günü sıfırlama ya da saati geri alma yaptırımı atlatır.
import { describe, it, expect } from "vitest";
import { birlestir, enErken, enIleri } from "../electron/lisansKalici.cjs";

describe("enErken / enIleri", () => {
  it("en erken ve en ileri tarihi seçer, null'ları atar", () => {
    expect(enErken("2026-07-10", "2026-07-01")).toBe("2026-07-01");
    expect(enIleri("2026-07-10", "2026-07-01")).toBe("2026-07-10");
    expect(enErken("2026-07-05", null)).toBe("2026-07-05");
    expect(enIleri(null, null)).toBeNull();
  });
});

describe("birlestir — kurulum tarihi (deneme-sıfırlama sertleştirmesi)", () => {
  it("data.db silinmiş (meta boş) ama dosyada eski kurulum var → eski tarih korunur", () => {
    const r = birlestir({ dosya: { kurulumTarihi: "2026-06-01" }, meta: {}, bugun: "2026-07-19", yeniMakineId: "yeni" });
    expect(r.kurulumTarihi, "deneme sıfırlanmamalı").toBe("2026-06-01");
  });
  it("iki kaynak da varsa en ERKEN seçilir", () => {
    const r = birlestir({
      dosya: { kurulumTarihi: "2026-07-10" },
      meta: { kurulumTarihi: "2026-06-15" },
      bugun: "2026-07-19",
      yeniMakineId: "y",
    });
    expect(r.kurulumTarihi).toBe("2026-06-15");
  });
  it("gelecekteki kurulum tarihi bugüne çekilir (saati ileri alma denemesi)", () => {
    const r = birlestir({ dosya: { kurulumTarihi: "2099-01-01" }, meta: {}, bugun: "2026-07-19", yeniMakineId: "y" });
    expect(r.kurulumTarihi).toBe("2026-07-19");
  });
  it("hiç kaynak yoksa kurulum bugündür (temiz kurulum, kilitlemez)", () => {
    expect(birlestir({ dosya: null, meta: null, bugun: "2026-07-19", yeniMakineId: "y" }).kurulumTarihi).toBe("2026-07-19");
  });
});

describe("birlestir — sonGorulen (saat-geri-alma işareti)", () => {
  it("en İLERİ tarih korunur (dosya vs meta)", () => {
    const r = birlestir({
      dosya: { sonGorulen: "2026-07-25" },
      meta: { sonGorulen: "2026-07-10" },
      bugun: "2026-07-05",
      yeniMakineId: "y",
    });
    expect(r.sonGorulen).toBe("2026-07-25");
  });
  it("hiç işaret yoksa null (durumHesapla bugünü kullanır)", () => {
    expect(birlestir({ dosya: {}, meta: {}, bugun: "2026-07-19", yeniMakineId: "y" }).sonGorulen).toBeNull();
  });
});

describe("birlestir — lease taşıma (B2)", () => {
  it("lease dosyadan taşınır; yoksa meta'dan; ikisi de yoksa null", () => {
    expect(birlestir({ dosya: { lease: "FOKLEASE.x" }, meta: {}, bugun: "2026-07-19", yeniMakineId: "y" }).lease).toBe("FOKLEASE.x");
    expect(birlestir({ dosya: {}, meta: { lease: "FOKLEASE.m" }, bugun: "2026-07-19", yeniMakineId: "y" }).lease).toBe("FOKLEASE.m");
    expect(birlestir({ dosya: {}, meta: {}, bugun: "2026-07-19", yeniMakineId: "y" }).lease).toBeNull();
  });
});

describe("birlestir — makineId", () => {
  it("kaynaklardan biri taşıyorsa YENİSİ üretilmez (sabit kalır)", () => {
    expect(birlestir({ dosya: { makineId: "MAK-1" }, meta: {}, bugun: "2026-07-19", yeniMakineId: "yeni" }).makineId).toBe("MAK-1");
    expect(birlestir({ dosya: {}, meta: { makineId: "MAK-2" }, bugun: "2026-07-19", yeniMakineId: "yeni" }).makineId).toBe("MAK-2");
  });
  it("hiçbir kaynakta yoksa yeni üretilen kullanılır", () => {
    expect(birlestir({ dosya: null, meta: null, bugun: "2026-07-19", yeniMakineId: "YENI-UUID" }).makineId).toBe("YENI-UUID");
  });
});
