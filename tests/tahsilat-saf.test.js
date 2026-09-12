// Tahsilat saf hesapları (refactor 2. tur §8.2): Tahsilat.jsx'ten çıkarılan mantık; UI testleri (tests/ui/tahsilat*.test.jsx) davranışı
// ekranda sınar, burada sınır durumları.
import { describe, it, expect } from "vitest";
import {
  ayAnahtar,
  ayCoz,
  ilkOdenmemisAy,
  baslangicAySecimi,
  donemSecenekleri,
  seciliAylar,
  toplamlar,
  makbuzSatirlari,
  uzunDonemSecimi,
} from "../src/lib/tahsilat.js";

const due = (yil, ay, durum, tutar = 3500, odenen = 0) => ({ yil, ay, durum, tutar, odenen });

describe("tahsilat saf", () => {
  it("ay anahtarı gidiş-dönüş", () => {
    expect(ayCoz(ayAnahtar(2026, 9))).toEqual({ yil: 2026, ay: 9 });
  });
  it("ilkOdenmemisAy: ödenmiş ayları atlar, 12 ay ileriye bakar, hepsi ödenmişse null", () => {
    const d = [due(2026, 9, "odendi"), due(2026, 10, "odendi")];
    expect(ilkOdenmemisAy(d, 2026, 9)).toEqual({ yil: 2026, ay: 11 });
    expect(ilkOdenmemisAy([due(2026, 12, "kismi")], 2026, 12)).toEqual({ yil: 2026, ay: 12 });
    const hepsi = Array.from({ length: 12 }, (_, i) => due(2026 + Math.floor((8 + i) / 12), ((8 + i) % 12) + 1, "odendi"));
    expect(ilkOdenmemisAy(hepsi, 2026, 9)).toBeNull();
  });
  it("baslangicAySecimi: en eski borç kalanıyla; borç yoksa ilk ödenmemiş ay tam aidatla; ücretsiz/0 aidat boş", () => {
    const o = { ucret_tipi: "normal", aylik_aidat: 3500 };
    expect(baslangicAySecimi(o, [due(2026, 10, "odenmedi"), due(2026, 9, "kismi", 3500, 1000)], 2026, 10)).toEqual({ "2026-9": "2500" });
    expect(baslangicAySecimi(o, [due(2026, 9, "odendi")], 2026, 9)).toEqual({ "2026-10": "3500" });
    expect(baslangicAySecimi({ ucret_tipi: "ucretsiz", aylik_aidat: 3500 }, [], 2026, 9)).toEqual({});
    expect(baslangicAySecimi({ ucret_tipi: "normal", aylik_aidat: 0 }, [], 2026, 9)).toEqual({});
  });
  it("donemSecenekleri: vadesi gelmiş borçlar kırmızı önce; gelecek açık aylar borç değil; ödenmişler atlanır; 3 gelecek; ekstra seçim pil olur", () => {
    const d = [due(2026, 8, "odenmedi"), due(2026, 9, "odendi"), due(2026, 11, "odenmedi")];
    const s = donemSecenekleri(d, { "2027-3": "3500" }, 2026, 9);
    expect(s.map((x) => [x.yil, x.ay, x.borc])).toEqual([
      [2026, 8, true],
      [2026, 10, false],
      [2026, 11, false],
      [2026, 12, false],
      [2027, 3, false],
    ]);
    expect(s[0].kalan).toBe(3500);
  });
  it("seciliAylar sıralı; toplamlar; makbuzSatirlari 0 tutarı atlar ve ay sırasında; aidat kalemi yoksa aidat satırı yok", () => {
    const aylar = { "2026-10": "3000", "2026-9": "3500", "2026-11": "0" };
    expect(seciliAylar(aylar).map((d) => d.ay)).toEqual([9, 10, 11]);
    expect(toplamlar(aylar, { 2: "1200", 3: "" })).toEqual({ aidat: 6500, toplam: 7700 });
    const kalemler = [
      { id: 1, kod: "aidat", ad: "Aidat" },
      { id: 2, kod: "forma", ad: "Forma" },
    ];
    expect(makbuzSatirlari(aylar, { 2: "1200", 3: "" }, kalemler, kalemler[0])).toEqual([
      { fee_item_id: 1, tutar: 3500, aciklama: "Eylül 2026", yil: 2026, ay: 9 },
      { fee_item_id: 1, tutar: 3000, aciklama: "Ekim 2026", yil: 2026, ay: 10 },
      { fee_item_id: 2, tutar: 1200, aciklama: "Forma", yil: null, ay: null },
    ]);
    expect(makbuzSatirlari(aylar, {}, kalemler, undefined)).toEqual([]);
  });
  it("uzunDonemSecimi: kalanı 0 olan (ödenmiş) ay girmez, kaydı olmayan ay tam aidat", () => {
    const aylar = [
      { yil: 2026, ay: 9 },
      { yil: 2026, ay: 10 },
      { yil: 2026, ay: 11 },
    ];
    expect(uzunDonemSecimi(aylar, [due(2026, 9, "odendi", 3500, 3500), due(2026, 10, "kismi", 3500, 500)], 3500)).toEqual({
      "2026-10": "3000",
      "2026-11": "3500",
    });
  });
  it("donemSecenekleri: bu ayın vadesi gelmemiş aidatı (vade_gecti=0) borç değil, sade seçenek (plan §38); vade_gecti yoksa eski davranış", () => {
    const d = [{ ...due(2026, 9, "odenmedi"), vade_gecti: 0 }];
    const s = donemSecenekleri(d, {}, 2026, 9);
    expect(s[0]).toMatchObject({ yil: 2026, ay: 9, borc: false });
    expect(donemSecenekleri([{ ...due(2026, 9, "odenmedi"), vade_gecti: 1 }], {}, 2026, 9)[0].borc).toBe(true);
    expect(donemSecenekleri([due(2026, 9, "odenmedi")], {}, 2026, 9)[0].borc).toBe(true);
    // seçili gelir: baslangicAySecimi vadesi gelmemiş ayı yine seçer (veli ödemeye gelmiştir)
    expect(baslangicAySecimi({ ucret_tipi: "normal", aylik_aidat: 3500 }, d, 2026, 9)).toEqual({ "2026-9": "3500" });
  });
});
