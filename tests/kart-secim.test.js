// Giriş kartı basım penceresi — saf seçim/sayaç yardımcıları (plan §40.7)
import { describe, it, expect } from "vitest";
import {
  KART_SINIR,
  sayfaSayisi,
  secimDegistir,
  tumunuSec,
  bastakiKutu,
  listedeOlmayan,
  basimEtiketi,
  basilmisSecilenler,
  basilmisNotu,
  kisaAd,
} from "../src/lib/kartSecim.js";

describe("kartSecim", () => {
  it("sayfa sayısı: 6 kart/sayfa, ön + arka", () => {
    expect(sayfaSayisi(0)).toBe(0);
    expect(sayfaSayisi(1)).toBe(2);
    expect(sayfaSayisi(6)).toBe(2);
    expect(sayfaSayisi(7)).toBe(4);
    expect(KART_SINIR).toBe(200);
  });
  it("seçim aç/kapa, tümünü seç/kaldır, başlık kutusu durumu, listede olmayanlar", () => {
    let s = new Set();
    s = secimDegistir(s, 1);
    s = secimDegistir(s, 2);
    s = secimDegistir(s, 1);
    expect([...s]).toEqual([2]);
    expect(bastakiKutu(s, [2, 3])).toBe("kismi");
    s = tumunuSec(s, [2, 3], true);
    expect(bastakiKutu(s, [2, 3])).toBe("hepsi");
    expect(bastakiKutu(new Set(), [])).toBe("hic");
    expect(listedeOlmayan(s, [3, 4])).toEqual([2]); // süzgeç değişti: 2 seçili ama listede değil
    s = tumunuSec(s, [2, 3], false);
    expect(s.size).toBe(0);
  });
  it("son basım etiketi ve sarı not", () => {
    expect(basimEtiketi({ basim_sayisi: 0 })).toEqual({ metin: "Basılmadı", ton: "gray" });
    expect(basimEtiketi({ basim_sayisi: 1, son_basim: "2026-09-12 10:00:00" })).toEqual({ metin: "12.09.2026", ton: "green" });
    expect(basimEtiketi({ basim_sayisi: 2, son_basim: "2026-09-12 10:00:00" })).toEqual({ metin: "2. basım · 12.09.2026", ton: "yellow" });
    const bilinen = new Map([
      [1, { id: 1, ad_soyad: "Kerem Yılmaz", basim_sayisi: 1 }],
      [2, { id: 2, ad_soyad: "Ela Demir", basim_sayisi: 0 }],
      [3, { id: 3, ad_soyad: "Kaan Yıldız", basim_sayisi: 2 }],
    ]);
    const b = basilmisSecilenler(new Set([1, 2, 3, 9]), bilinen);
    expect(b.map((o) => o.id)).toEqual([1, 3]);
    expect(basilmisNotu(b)).toBe("2'ü daha önce basılmış (Kerem Y., Kaan Y.)");
    expect(basilmisNotu(b.slice(0, 1))).toBe("1'i daha önce basılmış (Kerem Y.)");
    expect(basilmisNotu([])).toBe("");
    expect(basilmisNotu([...b, ...b, ...b].map((o, i) => ({ ...o, ad_soyad: "Ad " + i })))).toContain("+3");
    expect(kisaAd("Ahmet Can Öz")).toBe("Ahmet Can Ö.");
    expect(kisaAd("Tek")).toBe("Tek");
  });
});
