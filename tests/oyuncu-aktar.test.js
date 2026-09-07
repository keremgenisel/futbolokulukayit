import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const { satirlariCoz, tarihCoz, gsmCoz, basliklariEsle } = createRequire(import.meta.url)("../electron/oyuncuAktar.cjs");

const gruplar = [{ id: 1, ad: "U11" }, { id: 2, ad: "U 12" }];
const baslik = ["Ad Soyad", "TC Kimlik No", "Doğum Tarihi", "Yaş Grubu", "Durum", "Ücret Tipi", "Aylık Aidat", "Ödeme Dönemi", "GSM", "Veli Adı", "Veli Telefonu", "Pasaport No"];

describe("Excel oyuncu aktarımı — satır çözümleme", () => {
  it("tarih biçimleri: gg.aa.yyyy, yyyy-aa-gg, Date, Excel seri no", () => {
    expect(tarihCoz("02.11.2015")).toBe("2015-11-02");
    expect(tarihCoz("2/11/2015")).toBe("2015-11-02");
    expect(tarihCoz("2015-11-02")).toBe("2015-11-02");
    expect(tarihCoz(new Date(Date.UTC(2015, 10, 2)))).toBe("2015-11-02");
    expect(tarihCoz(42310)).toBe("2015-11-02");
    expect(tarihCoz("bozuk")).toBeNull();
  });
  it("GSM normalize: +90, boşluk, 10 hane", () => {
    expect(gsmCoz("+90 532 123 45 67")).toBe("05321234567");
    expect(gsmCoz("532 123 45 67")).toBe("05321234567");
    expect(gsmCoz("0532-123-4567")).toBe("05321234567");
  });
  it("başlıklar toleranslı eşleşir", () => {
    const es = basliklariEsle(["  AD SOYAD ", "Tc No", "Doğum Tarihi", "Yas Grubu", "Bilinmeyen"]);
    expect(es).toEqual({ ad_soyad: 0, tc_no: 1, dogum_tarihi: 2, yas_grubu: 3 });
  });
  it("zorunlu sütun yoksa hata, hiç kayıt üretmez", () => {
    const r = satirlariCoz([["Ad Soyad", "TC"], ["Ali", "1"]], { gruplar });
    expect(r.kayitlar).toHaveLength(0);
    expect(r.hatalar[0].mesaj).toMatch(/doğum tarihi/);
  });
  it("satırlar çözülür: grup eşleşir/yeni grup, durum/ücret/dönem, veli, TC kontrolü, mükerrer atlama", () => {
    const satirlar = [baslik,
      ["Kaan Yıldız", "12345678901", "02.11.2015", "u11", "Aktif", "Kardeş", "3.500", "11-20", "532 111 22 33", "Ayşe Yıldız", "0532 444 55 66", ""],
      ["Ela Demir", "", "2017-06-21", "U 12", "Deneme", "Burslu", "0", "", "", "", "", ""],
      ["Ivan Petrov", "", "2014-02-02", "U13", "", "", "3500", "1-10", "", "", "", "u1234567"],
      ["Kopya TC", "12345678901", "01.01.2015", "", "", "", "", "", "", "", "", ""],
      ["Zaten Var", "99999999999", "01.01.2015", "", "", "", "", "", "", "", "", ""],
      ["Kısa TC", "123", "01.01.2015", "", "", "", "", "", "", "", "", ""],
      ["Tarihsiz", "", "yok", "", "", "", "", "", "", "", "", ""],
      ["Garip", "", "01.01.2015", "", "Emekli", "Bedava", "", "5-15", "", "", "", ""],
      [null, null, null],
    ];
    const r = satirlariCoz(satirlar, { gruplar, mevcutTc: new Set(["99999999999"]) });
    expect(r.kayitlar.map((k) => k.ad_soyad)).toEqual(["Kaan Yıldız", "Ela Demir", "Ivan Petrov", "Garip"]);
    const kaan = r.kayitlar[0];
    expect(kaan).toMatchObject({ tc_no: "12345678901", dogum_tarihi: "2015-11-02", yas_grubu_id: 1, durum: "aktif", ucret_tipi: "kardes", aylik_aidat: 3500, odeme_donemi: "11-20", gsm: "05321112233", satir: 2 });
    expect(kaan.veli).toEqual({ ad_soyad: "Ayşe Yıldız", gsm: "05324445566" });
    expect(r.kayitlar[1]).toMatchObject({ yas_grubu_id: 2, durum: "deneme", ucret_tipi: "burslu", aylik_aidat: 0, odeme_donemi: "1-10", tc_no: null });
    expect(r.kayitlar[2]).toMatchObject({ uyruk: "yabanci", pasaport_no: "U1234567", yeni_grup: "U13" });
    expect(r.yeniGruplar).toEqual(["U13"]);
    expect(r.hatalar.map((h) => h.satir)).toEqual([7, 8]);
    expect(r.uyarilar.map((u) => u.satir).sort()).toEqual([5, 6, 9, 9, 9]);
    expect(r.kayitlar[3]).toMatchObject({ durum: "aktif", ucret_tipi: "normal", odeme_donemi: "1-10" });
  });
  it("Ayarlar'dan eklenen ücret tipi adı ya da koduyla tanınır; tanınmayan Normal olur ve uyarı verir", () => {
    const tipler = [{ kod: "sampiyon_bursu", ad: "Şampiyon Bursu" }, { kod: "kardes", ad: "Kardeş İndirimi" }];
    const r = satirlariCoz([["Ad Soyad", "Doğum Tarihi", "Ücret Tipi"], ["A", "01.01.2015", "Şampiyon Bursu"], ["B", "01.01.2015", "sampiyon_bursu"], ["C", "01.01.2015", "Bilinmeyen"]], { gruplar: [], ucretTipleri: tipler });
    expect(r.kayitlar.map((k) => k.ucret_tipi)).toEqual(["sampiyon_bursu", "sampiyon_bursu", "normal"]);
    expect(r.uyarilar.some((u) => /"bilinmeyen" tanınmadı/.test(u.mesaj))).toBe(true);
  });
});
